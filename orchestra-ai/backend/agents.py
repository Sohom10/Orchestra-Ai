import re
import json
import os
import time
import asyncio
import logging
from typing import List, TypedDict, Optional, Annotated
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph.message import add_messages

load_dotenv()
logger = logging.getLogger("orchestra")
from database import db_manager
class AgentState(TypedDict):
    task: str
    persona: str
    plan: str
    research_notes: Annotated[List[str], lambda x, y: x + y]
    citations: Annotated[List[str], lambda x, y: list(set(x + y))]
    local_context: Annotated[List[str], lambda x, y: x + y]
    visuals: Annotated[List[str], lambda x, y: x + y] 
    visual_prompts: Annotated[List[str], lambda x, y: x + y]
    critic_feedback: str
    generate_images: bool

    final_output: str
    revision_count: int
    max_revisions: int
    messages: Annotated[List[BaseMessage], add_messages]
    supporting_evidence: Annotated[List[str], lambda x, y: x + y]

# ---------------------------------------------------------------------------
# Advanced Model Manager with Rate Limiting & Rotation
# ---------------------------------------------------------------------------
class ModelManager:
    def __init__(self):
        # Initialize Google Models (Primary for Synthesis/Reasoning)
        self.google_architect = ChatGoogleGenerativeAI(model="gemini-1.5-flash", convert_system_message_to_human=True, max_retries=1)
        self.google_critic = ChatGoogleGenerativeAI(model="gemini-1.5-flash", convert_system_message_to_human=True, max_retries=1)
        self.google_synthesizer = ChatGoogleGenerativeAI(model="gemini-1.5-pro", convert_system_message_to_human=True, max_retries=1)
        
        # Initialize Groq Models (Primary for Speed/Research)
        self.groq_architect = ChatGroq(model="llama-3.3-70b-versatile")
        self.groq_researcher = ChatGroq(model="llama-3.3-70b-versatile")
        self.groq_critic = ChatGroq(model="llama-3.1-8b-instant")
        self.groq_synthesizer = ChatGroq(model="llama-3.3-70b-versatile")
        
        # Pacing and sliding-window rate limit tracking
        self.lock = asyncio.Lock()
        self.groq_history = []
        self.google_history = []
        
        # Rate limit status
        self.google_on_cooldown = False
        self.cooldown_start = 0.0

    async def _wait_for_pacing(self, provider: str):
        async with self.lock:
            now = time.time()
            if provider == "google":
                # Clean up timestamps older than 60 seconds
                self.google_history = [t for t in self.google_history if now - t < 60]
                
                # Check sliding-window limit (15 requests per 60 seconds)
                if len(self.google_history) >= 15:
                    oldest = self.google_history[0]
                    wait_time = max(0.1, 60.0 - (now - oldest))
                    logger.info(f"[ModelManager] Gemini API limit reached. Pacing for {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    now = time.time()
                    self.google_history = [t for t in self.google_history if now - t < 60]
                
                # Enforce minimal sequential gap (2.0s between calls)
                if self.google_history:
                    last_call = self.google_history[-1]
                    elapsed = now - last_call
                    if elapsed < 2.0:
                        await asyncio.sleep(2.0 - elapsed)
                        now = time.time()

                self.google_history.append(now)
                
            elif provider == "groq":
                # Clean up timestamps older than 60 seconds
                self.groq_history = [t for t in self.groq_history if now - t < 60]
                
                # Check sliding-window limit (30 requests per 60 seconds)
                if len(self.groq_history) >= 30:
                    oldest = self.groq_history[0]
                    wait_time = max(0.1, 60.0 - (now - oldest))
                    logger.info(f"[ModelManager] Groq API limit reached. Pacing for {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    now = time.time()
                    self.groq_history = [t for t in self.groq_history if now - t < 60]
                
                # Enforce minimal sequential gap (1.0s between calls)
                if self.groq_history:
                    last_call = self.groq_history[-1]
                    elapsed = now - last_call
                    if elapsed < 1.0:
                        await asyncio.sleep(1.0 - elapsed)
                        now = time.time()

                self.groq_history.append(now)

    async def _invoke_safe(self, role: str, prompt: str | List[BaseMessage], provider_hint: Optional[str] = None, max_retries: int = 2):
        now = time.time()
        if self.google_on_cooldown and (now - self.cooldown_start > 60):
            self.google_on_cooldown = False
 
        # Hybrid Logic: Force specific providers for specific roles if hinted
        if provider_hint == "google":
            providers = ["google", "groq"] if not self.google_on_cooldown else ["groq"]
        elif provider_hint == "groq":
            providers = ["groq", "google"]
        else:
            providers = ["google", "groq"] if not self.google_on_cooldown else ["groq"]
        
        for provider in providers:
            for attempt in range(max_retries):
                try:
                    await self._wait_for_pacing(provider)
                    
                    if provider == "google":
                        llm = self.google_architect if role == "architect" else (self.google_critic if role == "critic" else self.google_synthesizer)
                    else:
                        llm = self.groq_architect if role == "architect" else (self.groq_critic if role == "critic" else self.groq_synthesizer)
                    
                    return await llm.ainvoke(prompt)
                
                except Exception as e:
                    err_str = str(e).lower()
                    if provider == "google" and any(x in err_str for x in ["429", "resource_exhausted", "rate_limit", "503", "unavailable"]):
                        self.google_on_cooldown = True
                        self.cooldown_start = time.time()
                        break 
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt * 2)
                    else:
                        if provider == providers[-1]:
                            raise e
                        break
        raise RuntimeError("All LLM providers failed.")

model_manager = ModelManager()
search_tool = DuckDuckGoSearchRun()

# --- Node: Architect (SPEED) ---
async def architect_node(state: AgentState):
    logger.info("[Architect] Analyzing task and history (using Groq for speed)...")
    
    history_context = ""
    if state["messages"]:
        history_context = "Conversation history for context:\n" + "\n".join([f"{m.type}: {m.content}" for m in state["messages"][-5:]])

    local_data = ""
    if state.get("local_context"):
        local_data = "\nUser uploaded document context:\n" + "\n---\n".join(state["local_context"])[:3000]

    prompt = (
        f"You are a research Architect. Create a concise 3-step research plan for: '{state['task']}'.\n"
        f"{history_context}\n"
        f"{local_data}\n"
        "Instructions: Incorporate any relevant local context provided above. Format: Numbered list."
    )
    # Use Groq for instant response
    response = await model_manager._invoke_safe("architect", prompt, provider_hint="groq")
    return {"plan": str(response.content), "revision_count": 0}

# --- Node: Researcher (SPEED) ---
async def researcher_node(state: AgentState):
    revision = state.get("revision_count", 0)
    logger.info(f"[Researcher] Gathering intelligence (Round {revision + 1})...")
    
    # 1. Generate specialized sub-queries for broader coverage
    query_prompt = (
        f"For the research task: '{state['task']}', generate 3 distinct search queries to gather comprehensive real-world data. "
        "Include one for official logistical details, one for current status, and one for future outlook. "
        "IMPORTANT: Queries MUST be 3-5 words. "
        "CRITICAL: Avoid keywords like 'FIFA' alone which trigger video game results. Use 'World Cup tournament' or 'real-world events'. "
        "Exclude all video game, simulation, or fantasy sports results."
        "Return ONLY a raw JSON array of 3 strings. No preamble."
    )
    
    try:

        query_response = await model_manager._invoke_safe("architect", query_prompt, provider_hint="groq")
        raw_queries = str(query_response.content)
        json_match = re.search(r'\[.*\]', raw_queries, re.DOTALL)
        if json_match:
            sub_queries = json.loads(json_match.group(0))
        else:
            sub_queries = [state["task"]] * 3
        logger.info(f"[Researcher] Generated sub-queries: {sub_queries}")
    except Exception as e:
        logger.warning(f"Failed to generate sub-queries: {e}. Using original task.")
        sub_queries = [state["task"]] * 3

    # 2. Information Retrieval (Paced Sequential Searches)
    search_tool = DuckDuckGoSearchRun()
    search_sem = asyncio.Semaphore(1)
    
    async def single_search(q, index):
        # Stagger startup of parallel tasks to enforce sequential spacing
        await asyncio.sleep(index * 1.5)
        
        async with search_sem:
            for attempt in range(2):
                try:
                    q_refined = q + " -game -sim -video" # Force exclusion of games
                    logger.info(f"[Researcher] Launching paced DDG search (Index {index}) for: '{q_refined}'")
                    res = await asyncio.get_event_loop().run_in_executor(None, lambda: search_tool.run(q_refined))
                    if res and len(res) > 50:
                        # Sleep 1.5s after successful API call to satisfy DDG rate limits
                        await asyncio.sleep(1.5)
                        return res
                except Exception as e:
                    logger.error(f"Search failed for {q} (Attempt {attempt+1}): {e}")
                    await asyncio.sleep(2.0)
            return ""

    # Execute searches with paced sequential gating
    search_tasks = [single_search(q, i) for i, q in enumerate(sub_queries)]
    results = await asyncio.gather(*search_tasks)
    
    combined_notes = "\n\n---\n\n".join([r for r in results if r])
    
    # Simple URL extraction
    urls = re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+', combined_notes)
    unique_urls = list(set(urls))[:5]


    return {"research_notes": [combined_notes], "citations": unique_urls}

# --- Node: Visualizer (NEW - High-Fidelity) ---
async def visualizer_node(state: AgentState):
    if not state.get("generate_images", True):
        logger.info("[Visualizer] Image generation skipped per user request.")
        return {"visuals": [], "visual_prompts": []}

    logger.info("[Visualizer] Performing Deep Data Contextual Analysis for all sections...")
    
    all_notes = "\n".join(state["research_notes"])
    context_window = all_notes[:4000]
    
    analysis_prompt = (
        f"The main research topic is: '{state['task']}'.\n"
        f"Analyze the following research notes to identify 6 distinct, highly relevant real-world themes, scenes, or key subjects. "
        "These MUST be directly related to the actual content of the research notes and appropriate for the topic (e.g., if the topic is sports, focus on stadiums, players, fans, equipment; if the topic is tech, focus on devices, data centers, users).\n\n"
        f"Research Notes:\n{context_window}\n\n"
        "For EACH of the 6 themes, you MUST generate a structured JSON object containing:\n"
        "- 'section': A short, 2-4 word title for this specific theme or section of the topic.\n"
        "- 'search_query': A concise 2-4 word Image Search Query (literal, physical objects, people, or locations only! e.g., 'football stadium crowd', 'wind turbine blade offshore'). Do NOT use abstract words.\n"
        "- 'detailed_description': A critically detailed, concrete, 30-40 word in-depth description of the physical scene or object for high-fidelity image generation. Specify lighting, textures, colors, and camera angle to make it incredibly lifelike and contextually accurate to the research topic. Avoid abstract concepts.\n"
        "- 'caption': A formal, academic caption (15-20 words) explaining how this specific object/scene illustrates a key finding in the context of the research report.\n\n"
        "CRITICAL TEMPORAL CONSTRAINT: Analyze if the research topic is historical, ancient, or set in a specific past era. "
        "If it is historical (e.g. Silk Road, ancient Rome, World War II), all generated 'search_query' and 'detailed_description' strings MUST strictly conform to that era. "
        "Explicitly exclude any modern objects, contemporary steel structures, asphalt roads, modern vehicles, modern surveillance cameras, or contemporary clothing. Use epoch-appropriate elements (e.g., stone towers, caravans, wooden sailing ships, ancient parchment).\n\n"
        "Return a raw JSON array of exactly 6 objects. Do NOT include any preamble, markdown code blocks, or explanations."
    )

    fallback_items = [
        {
            "section": "Core Overview",
            "search_query": f"{state['task']} overview",
            "detailed_description": f"A clean, modern, high-fidelity visual representing the core concept of {state['task']}.",
            "caption": f"An overview visualization illustrating the primary focus of the {state['task']} research."
        },
        {
            "section": "Key Subject",
            "search_query": f"{state['task']} main focus",
            "detailed_description": f"Close-up of the primary subject or activity associated with {state['task']}.",
            "caption": f"Detailed view of the critical elements involved."
        },
        {
            "section": "Environment",
            "search_query": f"{state['task']} environment",
            "detailed_description": f"The surrounding environment, facility, or setting where {state['task']} takes place.",
            "caption": f"Contextual setting and infrastructure."
        },
        {
            "section": "Real-World Impact",
            "search_query": f"{state['task']} real world",
            "detailed_description": f"Real-world scene of {state['task']} being experienced by people or affecting the world.",
            "caption": f"Global impact and practical realization in the field."
        },
        {
            "section": "Challenges",
            "search_query": f"{state['task']} challenge",
            "detailed_description": f"A scene depicting the difficulties, intensity, or challenges related to {state['task']}.",
            "caption": f"Evaluation of associated challenges and dynamic variables."
        },
        {
            "section": "Future Outlook",
            "search_query": f"{state['task']} future",
            "detailed_description": f"A forward-looking, visionary scene representing the future of {state['task']}.",
            "caption": f"Forward-looking perspective and next-generation developments."
        }
    ]
    
    try:
        # Use Groq for ultra-fast, high-quality prompt synthesis
        response = await model_manager._invoke_safe("architect", analysis_prompt, provider_hint="groq")
        raw_content = str(response.content)
        json_match = re.search(r'\[.*\]', raw_content, re.DOTALL)
        if json_match:
            visual_items = json.loads(json_match.group(0))
            if not isinstance(visual_items, list):
                visual_items = fallback_items
            elif len(visual_items) < 6:
                visual_items.extend(fallback_items[len(visual_items):6])
            visual_items = visual_items[:6]
        else:
            visual_items = fallback_items
    except Exception as e:
        logger.warning(f"Visualizer deep analysis failed: {e}")
        visual_items = fallback_items
        
    import urllib.parse
    import random
    import httpx as _httpx
    
    used_image_urls = set()

    async def generate_single_visual(i, item):
        async def save_image_metadata_cloud(file_name, prompt_str):
            try:
                metadata = await db_manager.get_image_metadata()
                metadata[file_name] = prompt_str
                await db_manager.save_image_metadata(metadata)
            except Exception as e:
                logger.warning(f"Failed to save image metadata to cloud: {e}")

        # Check if the research topic is historical
        historical_keywords = ["roman", "ancient", "history", "historical", "silk road", "medieval", "byzantine", "antiquity", "empire", "bc", "ad"]
        is_historical = any(k in state['task'].lower() for k in historical_keywords)

        # Extract structured details
        search_query = item.get("search_query", state['task'])
        detailed_desc = item.get("detailed_description", search_query)

        if is_historical:
            # Dynamically sanitize modern comparative leakages to their historical equivalents
            modern_to_historical = {
                "european union meeting": "roman senate assembly",
                "european union": "roman senate",
                "eu economic": "roman imperial",
                "eu ": "roman empire ",
                "modern": "ancient",
                "checkpoint": "fortress outpost",
                "office": "ancient study",
                "computer": "parchment scrolls",
                "fluorescent": "oil lamp",
                "conference room": "senate chamber",
                "officials": "senators"
            }
            for mod, hist in modern_to_historical.items():
                if mod in search_query.lower():
                    search_query = re.sub(re.escape(mod), hist, search_query, flags=re.IGNORECASE)
                if mod in detailed_desc.lower():
                    detailed_desc = re.sub(re.escape(mod), hist, detailed_desc, flags=re.IGNORECASE)
            
            # Auto-prepend ancient to historical queries to lock in theme search results
            if not any(k in search_query.lower() for k in ["ancient", "roman", "historical", "antique", "ruins", "old", "camel"]):
                search_query = f"ancient {search_query}"

        query = search_query.replace('\n', ' ').strip()
        
        async def download_and_upload(image_url, source_name):
            if image_url in used_image_urls: return None
            used_image_urls.add(image_url)
            try:
                async with _httpx.AsyncClient(follow_redirects=True, timeout=8.0) as dl_client:
                    resp = await dl_client.get(image_url)
                    if resp.status_code == 200 and len(resp.content) > 5000:
                        ext = "png" if "png" in resp.headers.get("content-type", "").lower() else "jpg"
                        file_name = f"{source_name}_{int(time.time())}_{i}.{ext}"
                        mime_type = resp.headers.get("content-type", f"image/{ext}")
                        public_url = await db_manager.upload_image(file_name, resp.content, mime_type=mime_type)
                        if public_url:
                            await save_image_metadata_cloud(file_name, detailed_desc)
                            logger.info(f"VEGEN: Successfully uploaded {source_name} image: {file_name}")
                            return public_url, json.dumps(item)
                        return image_url, json.dumps(item)
            except Exception as e:
                logger.warning(f"VEGEN: Failed to download/upload from {source_name}: {e}")
            return None

        # 1. Wikimedia Commons API
        logger.info(f"VEGEN: Attempting Wikimedia Commons for: '{query}'")
        for attempt in range(2):
            try:
                # Add a slight staggered delay to prevent hitting Wikimedia rate limits in parallel
                await asyncio.sleep(attempt * 1.5 + random.uniform(0.1, 0.5))
                wiki_url = "https://commons.wikimedia.org/w/api.php"
                wiki_params = {
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": f"filetype:bitmap {query}",
                    "gsrnamespace": "6",
                    "prop": "imageinfo",
                    "iiprop": "url",
                    "format": "json",
                    "gsrlimit": "3"
                }
                async with _httpx.AsyncClient(timeout=8.0) as client:
                    w_resp = await client.get(wiki_url, params=wiki_params, headers={"User-Agent": "OrchestraAI/1.0 (contact@orchestra.ai)"})
                    if w_resp.status_code == 200:
                        w_data = w_resp.json()
                        pages = w_data.get("query", {}).get("pages", {})
                        for page_id, page_info in pages.items():
                            imageinfo = page_info.get("imageinfo", [])
                            if imageinfo:
                                img_url = imageinfo[0].get("url")
                                if img_url:
                                    # Filter out unsupported file types
                                    lower_url = img_url.lower()
                                    if any(ext in lower_url for ext in [".svg", ".tif", ".tiff", ".ogg", ".ogv", ".pdf", ".djvu", ".gif"]):
                                        logger.info(f"VEGEN: Ignoring unsupported Wikimedia file type: {img_url}")
                                        continue
                                    res = await download_and_upload(img_url, "wikimedia")
                                    if res: return res
                        break  # Found no suitable results, skip retry
            except Exception as e:
                logger.warning(f"VEGEN: Wikimedia search attempt {attempt+1} failed: {e}")
                if attempt == 1:
                    break

        # 2. Pexels API
        pexels_key = os.getenv("PEXELS_API_KEY")
        if pexels_key:
            logger.info(f"VEGEN: Attempting Pexels API for: '{query}'")
            try:
                pex_url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=3"
                async with _httpx.AsyncClient(timeout=8.0) as client:
                    pex_resp = await client.get(pex_url, headers={"Authorization": pexels_key})
                    if pex_resp.status_code == 200:
                        pex_data = pex_resp.json()
                        for photo in pex_data.get("photos", []):
                            img_url = photo.get("src", {}).get("large")
                            if img_url:
                                res = await download_and_upload(img_url, "pexels")
                                if res: return res
            except Exception as e:
                logger.warning(f"VEGEN: Pexels search failed: {e}")

        # 3. Unsplash API
        unsplash_key = os.getenv("UNSPLASH_API_KEY")
        if unsplash_key:
            logger.info(f"VEGEN: Attempting Unsplash API for: '{query}'")
            try:
                un_url = f"https://api.unsplash.com/search/photos?query={urllib.parse.quote(query)}&per_page=3"
                async with _httpx.AsyncClient(timeout=8.0) as client:
                    un_resp = await client.get(un_url, headers={"Authorization": f"Client-ID {unsplash_key}"})
                    if un_resp.status_code == 200:
                        un_data = un_resp.json()
                        for photo in un_data.get("results", []):
                            img_url = photo.get("urls", {}).get("regular")
                            if img_url:
                                res = await download_and_upload(img_url, "unsplash")
                                if res: return res
            except Exception as e:
                logger.warning(f"VEGEN: Unsplash search failed: {e}")

        # Ultimate fallback placeholder
        logger.warning(f"VEGEN: All APIs exhausted for '{query}'. Falling back to placeholder.")
        safe_seed = "".join(c for c in query[:20] if c.isalnum()) + str(random.randint(1, 1000))
        fallback_url = f"https://picsum.photos/seed/{safe_seed}{i}/1024/768"
        return fallback_url, json.dumps(item)

    sem = asyncio.Semaphore(2)
    async def bounded_generate(i, item):
        # Stagger startup of parallel image tasks to spread API request load
        await asyncio.sleep(i * 1.0)
        async with sem:
            try:
                return await asyncio.wait_for(generate_single_visual(i, item), timeout=25.0)
            except asyncio.TimeoutError:
                logger.warning(f"VEGEN: Image {i} timed out after 25s, using placeholder.")
                safe_seed = "".join(c for c in item.get("search_query", "")[:20] if c.isalnum()) + str(i)
                return f"https://picsum.photos/seed/{safe_seed}/1024/768", json.dumps(item)

    visual_tasks = [bounded_generate(i, item) for i, item in enumerate(visual_items)]
    results = await asyncio.gather(*visual_tasks)
    
    visual_urls = [r[0] for r in results]
    visual_prompts = [r[1] for r in results]
        
    return {"visuals": visual_urls, "visual_prompts": visual_prompts}


# --- Node: Evidence (RAG - Supabase) ---
async def evidence_node(state: AgentState):
    logger.info("[Evidence] Querying Supabase for contextual support...")
    from database import db_manager
    import google.generativeai as genai
    
    try:
        # 1. Generate Query Embedding
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=state["task"],
            task_type="retrieval_query"
        )
        query_embedding = result['embedding']
        
        # 2. Search Supabase (RPC call to match_document_chunks)
        # Using a default match threshold of 0.4 for broader contextual reach
        results = await db_manager.search_documents(query_embedding, match_threshold=0.4)
        
        # 3. Format Evidence
        evidence = []
        for res in results:
            source = res['metadata'].get('source', 'Internal Document')
            evidence.append(f"[DOCUMENTAL EVIDENCE: {source}]\n{res['content']}")
            
        if not evidence:
            logger.info("No contextual evidence found in Supabase.")
            
        return {"supporting_evidence": evidence}
    except Exception as e:
        logger.error(f"Evidence Retrieval Error: {e}")
        return {"supporting_evidence": []}

# --- Node: Critic (SPEED) ---
async def critic_node(state: AgentState):
    logger.info("[Critic] Evaluating findings...")
    latest_notes = state["research_notes"][-1] if state["research_notes"] else "None"
    
    persona = state.get("persona", "Standard")
    if persona == "Skeptic":
        persona_instructions = "You are an ULTRA-HARSH SKEPTIC. Look for flaws, demand more concrete evidence, and critically attack assumptions."
    elif persona == "Visionary":
        persona_instructions = "You are a VISIONARY. Encourage bold ideas, forward-looking insights, and overlook minor logical gaps for the sake of grand ideas."
    else:
        persona_instructions = "You are a balanced evaluator."

    prompt = (
        f"Persona: {persona_instructions}\n"
        f"Research Plan: {state['plan']}\nLatest Notes: {latest_notes}\n"
        "Respond APPROVED if sufficient, otherwise provide ONE concise instruction for the researcher."
    )
    response = await model_manager._invoke_safe("critic", prompt, provider_hint="groq")
    return {"critic_feedback": str(response.content), "revision_count": state.get("revision_count", 0) + 1}

# --- Node: Synthesizer (DEPTH - Gemini) ---
async def synthesizer_node(state: AgentState):
    logger.info("[Synthesizer] Compiling final report (using Gemini for deep reasoning)...")
    all_notes = "\n\n".join(state["research_notes"])
    local_data = "\n".join(state.get("local_context", []))[:2000]
    
    image_rules = (
        "5. IMAGES: Place the following tags on their own lines within the relevant sections (ensure they are spaced out between paragraphs of text):\\n"
        "   - [[IMAGE_OVERVIEW]] (In the Brief)\\n"
        "   - [[IMAGE_TECHNICAL]] (In Technical Evolution)\\n"
        "   - [[IMAGE_MARKET]] (In Market Dynamics)\\n"
        "   - [[IMAGE_GLOBAL]] (In Global Impact)\\n"
        "   - [[IMAGE_RISK]] (In Risk Analysis)\\n"
        "   - [[IMAGE_CONCEPTUAL]] (In Strategic Outlook)\\n"
    ) if state.get("generate_images", True) else "5. IMAGES: Do NOT include any image tags.\\n"

    persona = state.get("persona", "Standard")
    if persona == "Skeptic":
        persona_prompt = "You are an ULTRA-HARSH SKEPTIC synthesizer. Emphasize risks, question the data heavily, point out contradictions, and be extremely pessimistic."
    elif persona == "Visionary":
        persona_prompt = "You are a VISIONARY synthesizer. Focus heavily on future possibilities, groundbreaking implications, paradigm shifts, and an incredibly optimistic future outlook."
    else:
        persona_prompt = "You are the Sovereign Scholar, an elite intelligence synthesizer."

    prompt = (
        f"{persona_prompt} "
        f"Create a comprehensive, deep-dive, high-fidelity research report for: '{state['task']}'\\n\\n"
        f"CONTEXT DATA:\\n{local_data}\\n\\n"
        f"RESEARCH FINDINGS:\\n{all_notes}\\n\\n"
        f"SUPPORTING DOCUMENTAL EVIDENCE:\\n{chr(10).join(state.get('supporting_evidence', []))}\\n\\n"
        "--- EDITORIAL STRUCTURE & RULES ---\\n"
        "CRITICAL: Write a long, comprehensive, and exhaustive academic-style report. Do NOT be brief. You must generate at least 1500-2000 words in total.\\n"
        f"CRITICAL: Your research notes may contain irrelevant noise. You MUST focus EXCLUSIVELY on the actual topic: '{state['task']}'.\\n"
        "1. EXECUTIVE BRIEF: Start with a detailed 2-paragraph summary of the most critical intelligence.\\n"
        "2. CORE INTELLIGENCE: Break the research into 4 thematic sections (e.g., Technical Evolution, Market Dynamics, Global Impact, Risk Analysis). Each section MUST contain at least 3-4 dense paragraphs of text to provide deep contextual analysis.\\n"
        "3. STRATEGIC OUTLOOK: Conclude with a detailed, multi-paragraph forward-looking section on what happens next in 2026-2027.\\n"
        "4. VISUALIZATION: You MUST include EXACTLY ONE Mermaid.js 'graph TD' diagram representing the system architecture or flow. This is a HARD REQUIREMENT. Wrap in ```mermaid.\\n"
        f"{image_rules}"
        "6. TYPOGRAPHY: Use professional, academic language. Mark 2024-2026 data as 'Current Intelligence'.\\n"
        "7. EVIDENCE: Cite all 'Internal Evidence' provided in context."

    )
    # Use Gemini for deep synthesis
    response = await model_manager._invoke_safe("synthesizer", prompt, provider_hint="google")
    
    content = str(response.content)
    final_text = content
    
    # Dynamic Tag Replacement with high-fidelity visuals
    # Safety: Strip multiple mermaid blocks to ensure only one remains at most
    # Using a more robust regex that handles case-insensitivity and varied whitespace
    mermaid_blocks = list(re.finditer(r"```mermaid\s*[\s\S]*?```", final_text, re.IGNORECASE))
    if len(mermaid_blocks) > 1:
        # Keep only the last one as it's usually the summary/architectural one
        last_block = mermaid_blocks[-1].group(0)
        # Remove all other blocks
        final_text = re.sub(r"```mermaid\s*[\s\S]*?```", "", final_text, flags=re.IGNORECASE)
        # Append the last block at the very end
        final_text += f"\n\n### System Architecture\n{last_block}"

    
    # --- Mandatory Report Integrity Check ---
    # If the LLM returned a sparse report, manually compile the research notes
    if len(final_text) < 500 and state.get("research_notes"):
        logger.warning("[Synthesizer] LLM returned sparse report. Manually compiling from research notes...")
        final_text += "\n\n## Supplemental Intelligence Analysis\n"
        for i, note in enumerate(state["research_notes"]):
            final_text += f"\n### Intelligence Segment {i+1}\n{note}\n"

    # --- Visual Asset Enforcement ---
    img_urls = state.get("visuals", [])
    img_prompts = state.get("visual_prompts", [])
    tags = ["[[IMAGE_OVERVIEW]]", "[[IMAGE_TECHNICAL]]", "[[IMAGE_MARKET]]", "[[IMAGE_GLOBAL]]", "[[IMAGE_RISK]]", "[[IMAGE_CONCEPTUAL]]"]
    
    used_indices = set()
    for i, tag in enumerate(tags):
        if i < len(img_urls):
            # Case-insensitive replacement
            pattern = re.compile(re.escape(tag), re.IGNORECASE)
            if pattern.search(final_text):
                raw_p = img_prompts[i] if i < len(img_prompts) else "Visual Intelligence"
                detailed_desc = "Visual Intelligence"
                caption = ""
                try:
                    visual_info = json.loads(raw_p)
                    detailed_desc = visual_info.get("detailed_description", detailed_desc)
                    caption = visual_info.get("caption", "")
                except Exception:
                    detailed_desc = raw_p
                    caption = ""

                alt_text = detailed_desc
                
                image_markdown = f"![{alt_text}]({img_urls[i]})"
                if caption:
                    image_markdown += f"\n\n*Figure {i+1}: {caption}*"
                
                final_text = pattern.sub(image_markdown, final_text)
                used_indices.add(i)
            else:
                final_text = pattern.sub("", final_text)

    # Append any remaining images to a Visual Evidence Supplement gallery
    remaining_images = [i for i in range(len(img_urls)) if i not in used_indices]
    if remaining_images:
        final_text += "\n\n---\n\n## Visual Intelligence Supplement\n"
        for i in remaining_images:
            raw_p = img_prompts[i] if i < len(img_prompts) else "Research Insight"
            detailed_desc = "Research Insight"
            caption = ""
            try:
                visual_info = json.loads(raw_p)
                detailed_desc = visual_info.get("detailed_description", detailed_desc)
                caption = visual_info.get("caption", "")
            except Exception:
                detailed_desc = raw_p
                caption = ""
                
            alt_text = detailed_desc
            
            final_text += f"\n### Technical Reference: {alt_text}...\n![{alt_text}]({img_urls[i]})\n"
            if caption:
                final_text += f"\n*Figure {i+1}: {caption}*\n"

    # --- Diagrammatic Intelligence Recovery ---
    if "```mermaid" not in final_text:
        logger.info("[Synthesizer] Missing diagram. Appending structural flowchart...")
        final_text += f"\n\n## System Architecture Map\n```mermaid\ngraph TD\n  Start(({state['task']})) --> Analysis[Intelligence Synthesis]\n  Analysis --> Findings[Research Discovery]\n  Findings --> Conclusion[Strategic Outlook]\n```\n"

    return {"final_output": final_text, "messages": [AIMessage(content=final_text)]}

# --- Router Logic ---
def should_continue(state: AgentState):
    feedback = state.get("critic_feedback", "").upper()
    revision = state.get("revision_count", 0)
    max_revs = state.get("max_revisions", 2)
    if "APPROVED" in feedback or revision >= max_revs:
        return "visualizer" # Route to visualizer after research is done
    return "researcher"

# --- Build the Graph ---
workflow = StateGraph(AgentState) # type: ignore
workflow.add_node("architect", architect_node)
workflow.add_node("researcher", researcher_node)
workflow.add_node("evidence", evidence_node)
workflow.add_node("visualizer", visualizer_node)
workflow.add_node("critic", critic_node)
workflow.add_node("synthesizer", synthesizer_node)

workflow.set_entry_point("architect")
workflow.add_edge("architect", "researcher")
workflow.add_edge("researcher", "critic")

workflow.add_conditional_edges(
    "critic", 
    should_continue, 
    {
        "visualizer": "evidence", 
        "researcher": "researcher"
    }
)

workflow.add_edge("evidence", "visualizer")
workflow.add_edge("visualizer", "synthesizer")
workflow.add_edge("synthesizer", END)

graph_app = workflow.compile()

