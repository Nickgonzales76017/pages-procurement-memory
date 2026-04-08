# Procurement Memory Site

> Unexpectedly strong enterprise use


## Pipeline Intelligence

| Capability | Detail |
|---|---|
| Transcription quality | **0.997** (HCP v3.2, tiny q5_0, 29 MB model) |
| Hallucination detection | **9 layers** — 0.09% error rate (1 in 1,096 segments) |
| Pipeline latency | **< 8 ms** per stage |
| Total binary size | **~2.1 MB** (48 static C11 binaries) |
| JSON compression | **9.3%** ratio with O(1) field reads (Lambda Tensors) |
| OpenAI compatibility | Drop-in via **bonfyre-proxy** (`/v1/audio/transcriptions`, `/v1/chat/completions`) |
| Tests passing | **167** |

## Architecture — Hybrid Path 3
- **WASM** (22KB): bonfyre-brief runs client-side for instant preview
- **Actions**: Full pipeline on push — transcribe, tag, tone, render, emit
- **Pages**: Auto-deploys on every push to `site/`

## Quick Start
1. Go to [the live app](https://nickgonzales76017.github.io/pages-procurement-memory/)
2. Configure your GitHub token in Settings
3. Drop a file — pipeline runs automatically

Powered by [Bonfyre](https://github.com/Nickgonzales76017/bonfyre) — 48 C11 binaries, ~2.1 MB total.
