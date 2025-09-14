# 🪿 Pew Pew — Goose Revenge VR

A chaotic VR FPS where you dodge poop, blast geese, and survive their savage roasts — built entirely by high school students who have stepped in goose poop one too many times.  

Play it here: [stupidahh.vercel.app](https://stupidahh.vercel.app)

---

## 🎮 Gameplay
- 🟤 Dodge piles of goose poop scattered around the map  
- 💥 Shoot geese before they charge you, honking and hurling insults  
- 🎙 Listen as geese roast you with proximity voice lines  
- 📈 Rack up points and survive endless waves of angry waterfowl  

**Warning:** Do NOT step on goose poop in real life. It’s not worth it. Trust us.

---

## 🧠 Inspiration
We’ve all heard the tales of Waterloo students getting terrorized by geese…  
but we didn’t need to hear the stories to know the pain.  

After enough near–back-breaking slips, we decided it was time to fight back.  
**Pew Pew** was born from pure vengeance… and the faint smell of regret on our sneakers.

---

## ⚙️ Tech Stack
- **A-Frame (WebXR)** — VR framework (running in-browser)
- **Blender** — cursed goose modeling
- **ElevenLabs** — goose insult voice lines
- **JavaScript / HTML / CSS** — core game logic, visuals, and UI
- **Vercel** — deployment

Originally started in **Unity**, but pivoted to **A-Frame** for faster iteration during the hackathon.

---

## 🧩 Features
- Dynamic goose AI that waddles menacingly  
- Proximity-based roast voice lines from geese  
- Poop landmine collisions and splatter effects  
- Ghost replay system for recording and dodging your past self  
- Tactical minimap + enemy markers

---

## 🚀 Running Locally
Clone the repo:
```bash
git clone https://github.com/B-Eddie/stupidahh.git
cd stupidahh
```

Install local A-Frame fallback (optional but recommended):
```bash
mkdir -p vendor
curl -L https://aframe.io/releases/1.5.0/aframe.min.js -o vendor/aframe.min.js
curl -L https://unpkg.com/aframe-extras@6.1.1/dist/aframe-extras.min.js -o vendor/aframe-extras.min.js
```

Then open `index.html` in a browser (or use Live Server / Vercel).  
If A-Frame fails to load from CDN, it will fall back to the local `vendor` versions.

---

## ⚠️ Troubleshooting
- Open DevTools console and run:
```js
AFRAME && AFRAME.version
```
If `undefined`, your network/CSP may be blocking the scripts.  
- Try switching to A-Frame 1.4.2 if 1.5.0 fails.
- Test `minimal-test.html` to confirm A-Frame loads correctly.

---

## 🧪 Known Bugs
- Goose physics occasionally launch them into the stratosphere (feature, not a bug)
- Poop collision sounds sometimes overlap infinitely
- Tactical map icons may flicker if you stare too hard at them

---

## 🧑‍💻 Team
- Eddie (@B-Eddie)  
- Eric (@eric-feng14)  
- Darren (@stony-su)  
- Arnnav (@blazecoding2009)

Built at HackTheNorth 2025 in a sleep-deprived haze fueled by vengeance, Red Bull, and the haunting memory of stepping in something warm.

---

## 📜 License
Internal prototype. Please don’t actually shoot real geese. (They will win.)
