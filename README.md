# Babai-Abbai

*Will Abbai get all his food?*

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
The Ultimate Gift is a giant platter heaped with biryani, BBQ chickens, idli and bonda. Reaching it gives a 5000 bonus, plus bonuses for time and remaining lives.

## Characters
- **Basha Bhai** (hero): `assets/hero-head.png`, plus `assets/caught-head.png` for his shocked face when caught.
- **Mental Balayya** (villain): `assets/villain-head.png`, his head sticks out of every veggie.

The heads were cut out of the original photos (face and hair, transparent background).
The final goal is **Unlimited Tindi**, a giant feast platter. `assets/game-over.jpg` shows on the Game Over screen.

Sounds: `assets/game-over.mp3` plays at game over and `assets/hit.mp3` plays when a villain catches the hero.
`assets/burp.mp3` is the burp when eating (sometimes a fart plays instead).

Movement (speed, jump height, gravity) is tuned in the `MOVE` table at the top of `game.js`.
