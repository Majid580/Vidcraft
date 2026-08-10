from fastapi import FastAPI

app = FastAPI(title="VidCraft AI Microservice")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
