# Slophoot
Webová kvízová hra ve stylu Kahootu (Next.js + Socket.io + SQLite/Drizzle).

## Spuštění
    npm install
    npm run dev      # http://localhost:3000
- Host: `/host` (vybere kvíz, dostane 4místný PIN)
- Hráč: hlavní stránka, PIN + přezdívka
- Editor kvízů: `/editor`

## Docker
    docker build -t slophoot . && docker run -p 3000:3000 -v $(pwd)/data:/app/data slophoot

## Znovupřipojení
Host i hráči se po obnovení stránky nebo výpadku spojení vrátí do své hry (identifikace přes token v `localStorage`).
Místnost bez hosta se po 10 minutách zruší; hru lze ukončit tlačítkem „Ukončit hru“.

## Windows
Dvojklik na `start.bat` (nainstaluje balíčky při prvním spuštění a spustí server). Vyžaduje Node.js 20 nebo 22 LTS.
