# Burp Hero: The Great Feast Run

A side-scrolling platformer for the browser. Guide a big-bellied hero to the **Ultimate Gift**,
eat everything along the way (every bite makes him burp), and stomp the evil green vegetables.

## Play
Open `index.html` in any modern browser. You don't need to install anything.

| Action | Keys |
|---|---|
| Move | ← → or A / D |
| Jump (hold for higher) | Space, ↑ or W |
| Run | Shift |
| Pause | P / Esc |
| Mute | M |

On-screen buttons appear automatically on phones and tablets.

## Food
| Item | Points |
|---|---|
| Bawarchi Biryani | 500 |
| Whole BBQ Chicken | 300 |
| Idli | 100 |
| Bonda | 100 |

Every bite makes the hero burp and get a little fatter. Stomping a veggie gives 200 points.
Reaching the gift gives a 5000 bonus, plus bonuses for time and remaining lives.

## Custom faces
There are two ways to add faces:
1. **In the game:** on the title screen, click **Hero face** or **Veggie face** and pick a photo.
   The browser remembers it.
2. **As files:** put the photos in `assets/` as `hero-face.jpg` and `veggie-face.jpg`
   (`.png` and `.webp` also work).

The game already includes `assets/hero-face.jpg` (the hero), `assets/veggie-face.jpg` (the villain veggies)
and `assets/game-over.jpg` (shown on the Game Over screen). If you upload photos in the game, they take
priority over these files. Click **reset faces** on the title screen to go back to the files.

When a villain veggie catches the hero, a big shocked version of his face pops up with "CAUGHT!".

Optional: add `assets/burp.mp3` to replace the built-in burp sound.
