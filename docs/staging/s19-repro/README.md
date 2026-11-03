# S19 local reproduction (NEM-016 report §16)

Disposable, **local-only** reproduction of the production and staging Docker network
layout, used to observe Docker's embedded-DNS behaviour on a shared external network.
It never touches the server.

```bash
docker network create zzproxy
docker compose -p zznoetia -f prod-layout.yml up -d
docker compose -p zznoetia_staging -f staging-layout.yml up -d
# Which environment answers "storage" from the staging api? (20 connections)
docker exec zznoetia_staging-api-1 node -e 'const n=require("net");let s={},k=0;for(let i=0;i<20;i++){const c=n.connect(9000,"storage");let d="";c.on("data",x=>d+=x);c.on("end",()=>{s[d.trim()]=(s[d.trim()]||0)+1;if(++k==20)console.log(s)})}'
# Fall-through: stop staging storage and repeat the line above
docker stop zznoetia_staging-storage-1
# Clean-up
docker compose -p zznoetia_staging -f staging-layout.yml down
docker compose -p zznoetia -f prod-layout.yml down
docker network rm zzproxy
```
