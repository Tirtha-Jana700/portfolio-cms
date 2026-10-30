from js import Response

async def on_fetch(request, env):
    """Minimal diagnostic handler to force a successful deployment."""
    return Response.new("Spatial Admin API is active.")
