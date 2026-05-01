#!/bin/bash
cd /home/carloskfe/Noetia
docker compose exec api npx ts-node --project tsconfig.json -r tsconfig-paths/register src/ingestion/seed-alignment.ts
