import markdown
import io
import asyncio
from xhtml2pdf import pisa

async def generate_pdf(report_markdown: str, title: str) -> bytes:
    """
    Converts markdown text to a PDF buffer.
    """
    # Convert markdown to HTML
    html_content = markdown.markdown(report_markdown, extensions=['extra', 'tables'])
    
    # Wrap in basic HTML structure
    full_html = f"""
    <html>
    <head>
        <title>{title}</title>
        <style>
            @page {{
                size: a4 portrait;
                @frame header_frame {{
                    -pdf-frame-content: header_content;
                    left: 50pt; width: 512pt; top: 50pt; height: 40pt;
                }}
                @frame content_frame {{
                    left: 50pt; width: 512pt; top: 90pt; height: 632pt;
                }}
                @frame footer_frame {{
                    -pdf-frame-content: footer_content;
                    left: 50pt; width: 512pt; top: 772pt; height: 20pt;
                }}
            }}
            body {{
                font-family: Helvetica, Arial, sans-serif;
                font-size: 12pt;
                line-height: 1.5;
            }}
            h1 {{
                color: #2c3e50;
                font-size: 24pt;
                margin-bottom: 20px;
            }}
            h2 {{
                color: #34495e;
                font-size: 18pt;
            }}
            p {{
                margin-bottom: 10px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }}
            th, td {{
                border: 1px solid #bdc3c7;
                padding: 8px;
                text-align: left;
            }}
            th {{
                background-color: #ecf0f1;
            }}
        </style>
    </head>
    <body>
        <div id="header_content"></div>
        <div id="footer_content">
            <pdf:pagenumber>
        </div>
        
        <h1>{title}</h1>
        {html_content}
    </body>
    </html>
    """
    
    # Create a bytes buffer
    result_file = io.BytesIO()
    
    # Custom link_callback to resolve external/relative URLs to local hashed cached files on disk
    def link_callback(uri, rel):
        import os
        import hashlib
        try:
            # Reconstruct filename format used by local cache
            if "pollinations.ai" in uri:
                url_path = uri.split('/')[-1].split('?')[0]
                filename = f"legacy_{url_path}.jpg"
            else:
                filename = os.path.basename(uri)
                
            file_hash = hashlib.sha256(filename.encode('utf-8')).hexdigest()
            path_jpg = os.path.join("static", "images", f"{file_hash}.jpg")
            path_png = os.path.join("static", "images", f"{file_hash}.png")
            
            if os.path.exists(path_jpg):
                return path_jpg
            elif os.path.exists(path_png):
                return path_png
        except Exception:
            pass
        return uri

    # Generate PDF. We use asyncio.to_thread to avoid blocking the event loop
    # if it's called from an async context, since CreatePDF is synchronous.
    def _create_pdf():
        pisa_status = pisa.CreatePDF(
            io.StringIO(full_html),
            dest=result_file,
            link_callback=link_callback
        )
        return pisa_status

    pisa_status = await asyncio.to_thread(_create_pdf)
    
    if pisa_status.err:
        raise Exception(f"PDF generation failed with errors: {pisa_status.err}")
        
    return result_file.getvalue()
