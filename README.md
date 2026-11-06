# WATCHER-X Dashboard v0.2.0

React + Vite frontend for the WATCHER-X multi-specialist PCB inspection API.

## Features

- Single-specialist inspection (DeepPCB, DsPCBSD+, PCB-Defect V2)
- Sequential three-specialist comparison on the same image
- Native HBB / OBB geometry and per-model class taxonomies
- Click-to-zoom defect evidence crops
- Optional evidence-first Qwen2.5-VL explanation panel
- GPU/API health and specialist checkpoint status

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Ensure the DGX API and SSH tunnel are running. See `../README_NEXT_SPRINT.md` for backend update and Qwen setup details.

The default API URL is `http://127.0.0.1:18080` (the local side of the SSH tunnel).
