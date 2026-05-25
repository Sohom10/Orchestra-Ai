import os
import httpx
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class SupabaseManager:
    def __init__(self):
        self.url: str = os.getenv("SUPABASE_URL") or ""
        self.key: str = os.getenv("SUPABASE_ANON_KEY") or ""
        if not self.url or not self.key:
            logger.warning("Supabase credentials missing. Cloud persistence will be disabled.")
            self.client_enabled = False
        else:
            self.client_enabled = True
            self.headers = {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }

    async def save_report(self, user_id: str, topic: str, plan: str, report: str, citations: list, token: str | None = None):
        if not self.client_enabled:
            return None
        
        try:
            data = {
                "user_id": user_id,
                "topic": topic,
                "plan": plan,
                "report": report,
                "citations": citations,
            }
            
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = f"Bearer {token}" if not token.startswith("Bearer ") else token
                
            logger.info(f"Supabase Save Payload: {topic} for {user_id}")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.url}/rest/v1/research_reports",
                    headers=headers,
                    json=data
                )
                if response.status_code not in [200, 201]:
                    logger.error(f"Supabase Error: {response.status_code} - {response.text}")
                    if response.status_code == 401:
                        logger.error("401 Unauthorized: Check if RLS is enabled and if the token is valid.")
                    elif response.status_code == 403:
                        logger.error("403 Forbidden: RLS policy might be blocking this operation.")

                response.raise_for_status()
                
                # Enforce the 15-research storage ceiling
                await self.enforce_storage_limit(user_id, token=token)
                
                return {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to save report to Supabase via REST: {e}")
            return None

    async def get_user_history(self, user_id: str, token: str | None = None):
        if not self.client_enabled:
            return []
        
        try:
            # Use the provided user token if available, otherwise fallback to anon key
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = token
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/research_reports?user_id=eq.{user_id}&order=created_at.desc",
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch history from Supabase via REST: {e}")
            return []

    async def delete_storage_files(self, filenames: list, token: str | None = None):
        """
        Deletes multiple files from the 'images' storage bucket in a single request.
        """
        if not self.client_enabled or not filenames:
            return
        
        bucket_id = "images"
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }
        if token:
            headers["Authorization"] = token if token.startswith("Bearer ") else f"Bearer {token}"
            
        try:
            delete_url = f"{self.url}/storage/v1/object/{bucket_id}"
            payload = {"prefixes": filenames}
            logger.info(f"Issuing Supabase Storage DELETE request for files: {filenames}")
            async with httpx.AsyncClient() as client:
                resp = await client.request("DELETE", delete_url, headers=headers, json=payload)
                if resp.status_code in [200, 201]:
                    logger.info(f"Successfully deleted files {filenames} from storage.")
                else:
                    logger.warning(f"Failed to delete files from storage: {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.error(f"Error deleting files from Supabase Storage: {e}")

    async def delete_report(self, user_id: str, report_id: str, token: str | None = None):
        if not self.client_enabled:
            return None
        
        try:
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = token if token.startswith("Bearer ") else f"Bearer {token}"
            
            # Fetch report first to find and purge any embedded Supabase Storage images
            async with httpx.AsyncClient() as client:
                fetch_url = f"{self.url}/rest/v1/research_reports?id=eq.{report_id}&user_id=eq.{user_id}"
                fetch_resp = await client.get(fetch_url, headers=headers)
                if fetch_resp.status_code == 200:
                    records = fetch_resp.json()
                    if records:
                        report_record = records[0]
                        report_content = report_record.get("report", "")
                        if report_content:
                            import re
                            prefix_url = f"{self.url}/storage/v1/object/public/images/"
                            pattern = re.escape(prefix_url) + r"([a-zA-Z0-9_\-\.]+)"
                            filenames = list(set(re.findall(pattern, report_content)))
                            if filenames:
                                logger.info(f"Found orphaned images in report {report_id} to clean up: {filenames}")
                                await self.delete_storage_files(filenames, token=token)

                response = await client.delete(
                    f"{self.url}/rest/v1/research_reports?id=eq.{report_id}&user_id=eq.{user_id}",
                    headers=headers
                )
                response.raise_for_status()
                return {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to delete report from Supabase: {e}")
            return None

    async def enforce_storage_limit(self, user_id: str, token: str | None = None):
        """
        Enforces a storage limit of exactly 15 researches per user.
        Deletes any data or files older than the top 15.
        """
        if not self.client_enabled:
            return
        
        try:
            history = await self.get_user_history(user_id, token=token)
            if len(history) > 15:
                to_delete = history[15:]
                logger.info(f"Enforcing storage ceiling for user {user_id}. Total reports: {len(history)}. Deleting {len(to_delete)} oldest reports.")
                for record in to_delete:
                    report_id = record.get("id")
                    if report_id:
                        logger.info(f"Pruning report {report_id} under storage limit.")
                        await self.delete_report(user_id, report_id, token=token)
        except Exception as e:
            logger.error(f"Failed to enforce storage limit: {e}")

    async def rename_report(self, user_id: str, report_id: str, new_title: str, token: str | None = None):
        if not self.client_enabled:
            return None
        
        try:
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = token if token.startswith("Bearer ") else f"Bearer {token}"
            
            data = {"topic": new_title}
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.url}/rest/v1/research_reports?id=eq.{report_id}&user_id=eq.{user_id}",
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                return {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to rename report in Supabase: {e}")
            return None


    async def save_document_chunk(self, content: str, embedding: list, metadata: dict, token: str | None = None):
        """Saves a single document chunk with its embedding to Supabase."""
        if not self.client_enabled:
            return None
        
        try:
            data = {
                "content": content,
                "embedding": embedding,
                "metadata": metadata,
            }
            
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = f"Bearer {token}" if not token.startswith("Bearer ") else token
                
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.url}/rest/v1/document_chunks",
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                return {"status": "success"}
        except Exception as e:
            logger.error(f"Failed to save chunk to Supabase: {e}")
            return None

    async def search_documents(self, query_embedding: list, match_threshold: float = 0.5, match_count: int = 5, token: str | None = None):
        """Performs a vector similarity search via Supabase RPC."""
        if not self.client_enabled:
            return []
        
        try:
            data = {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
            }
            
            headers = self.headers.copy()
            if token:
                headers["Authorization"] = f"Bearer {token}" if not token.startswith("Bearer ") else token
                
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.url}/rest/v1/rpc/match_document_chunks",
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to search Supabase vectors: {e}")
            return []

    async def upload_image(self, file_name: str, file_data: bytes, mime_type: str = "image/jpeg", token: str | None = None) -> str:
        """
        Saves the image locally using a safe SHA256 hashed path for self-healing static serving,
        and optionally attempts upload to Supabase Storage.
        Returns empty string so that the backend falls back to using the portable pollinations_url
        which is proxied and cached locally.
        """
        import os
        import hashlib
        
        # 1. Local Hashed Preservation
        try:
            os.makedirs("static/images", exist_ok=True)
            if file_name == "metadata.json":
                local_path = os.path.join("static", "images", "metadata.json")
            else:
                file_hash = hashlib.sha256(file_name.encode('utf-8')).hexdigest()
                ext = "png" if "png" in mime_type.lower() else "jpg"
                local_path = os.path.join("static", "images", f"{file_hash}.{ext}")
                
            with open(local_path, "wb") as f:
                f.write(file_data)
            logger.info(f"Successfully saved file locally to {local_path}")
        except Exception as e:
            logger.error(f"Failed to save file locally: {e}")

        # Always return empty string to force visualizer to use portable pollinations_url
        return ""

    async def get_image_metadata(self) -> dict:
        """Fetches the image metadata dictionary from local filesystem."""
        import json
        import os
        local_path = os.path.join("static", "images", "metadata.json")
        try:
            if os.path.exists(local_path):
                with open(local_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not fetch image metadata locally: {e}")
        return {}

    async def save_image_metadata(self, metadata: dict):
        """Saves the image metadata dictionary to local filesystem."""
        import json
        import os
        os.makedirs("static/images", exist_ok=True)
        local_path = os.path.join("static", "images", "metadata.json")
        try:
            with open(local_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            logger.info("Successfully saved image metadata locally.")
        except Exception as e:
            logger.warning(f"Could not save image metadata locally: {e}")



db_manager = SupabaseManager()
# End of file
