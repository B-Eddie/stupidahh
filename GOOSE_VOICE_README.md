# Goose Proximity Voice System

## Overview
The geese in your A-Frame VR game now have the ability to roast you with proximity-based voice lines! When you get close to a goose, it will randomly trigger one of 30 hilarious roast phrases.

## Features

### 🦢 Proximity Voice System
- **Proximity Detection**: Geese detect when you're within 5 units (configurable)
- **Smart Timing**: 3-7 second cooldown between roasts to prevent spam
- **Random Selection**: 30 unique roast phrases with goose-like prefixes
- **Visual Feedback**: HUD display shows what the goose is saying
- **Audio Support**: Uses Web Speech API for text-to-speech (with fallback to text-only)

### 🎯 Voice Lines
The geese will say things like:
- "HONK! You're moving like you're stuck in molasses!"
- "Honk honk! Are you lost? This isn't a daycare!"
- "HONK! Your reflexes are slower than a snail!"
- "Honk! I've seen better players in tutorial mode!"

### 🎮 How It Works
1. **Proximity Detection**: Each goose continuously checks distance to player
2. **Trigger**: When player enters proximity radius, goose has 70% chance to speak
3. **Cooldown**: Each goose has individual cooldown to prevent spam
4. **Voice Synthesis**: Uses browser's built-in speech synthesis
5. **Visual Display**: Shows roast text in bottom HUD with goose emoji

## Files Added/Modified

### New Files:
- `gooseVoice.js` - Main voice system implementation
- `voice-test.html` - Test page to try the voice system
- `GOOSE_VOICE_README.md` - This documentation

### Modified Files:
- `index.html` - Updated to use new voice-enabled spawn manager and added HUD

## Configuration

### Goose Spawn Manager Settings:
```html
goose-spawn-manager-with-voice="
  scale:0.35; 
  voiceEnabled:true; 
  voiceProximityRadius:5.0
"
```

### Individual Goose Voice Settings:
```html
goose-proximity-voice="
  proximityRadius:5.0; 
  target:#rig; 
  enabled:true
"
```

## Testing

### Main Game:
1. Open `index.html` in your browser
2. Walk close to any goose (within 5 units)
3. Listen for roast phrases and watch the HUD

### Voice Test Page:
1. Open `voice-test.html` for a dedicated test environment
2. Three test geese are placed around the map
3. Red rings show proximity zones
4. Walk into the rings to trigger voice lines

## Browser Compatibility

### Speech Synthesis:
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support  
- ✅ Safari: Full support
- ⚠️ Mobile browsers: May have limitations

### Fallback:
- If speech synthesis is unavailable, only the visual HUD will show
- Text will display for 3 seconds then fade out

## Customization

### Adding New Roast Phrases:
Edit the `ROAST_PHRASES` array in `gooseVoice.js`:

```javascript
const ROAST_PHRASES = [
  "Your new roast here!",
  "Another funny insult!",
  // ... add more phrases
];
```

### Adjusting Voice Settings:
Modify the voice configuration in the `synthesizeSpeech` method:

```javascript
utterance.rate = 0.9 + Math.random() * 0.2; // Speed
utterance.pitch = voiceData.pitch;          // Pitch
utterance.volume = voiceData.volume;        // Volume
```

### Changing Proximity Radius:
Update the `proximityRadius` in the component attributes or schema defaults.

## Technical Details

### Components:
- `goose-voice-system` - Manages audio context and voice synthesis
- `goose-proximity-voice` - Handles proximity detection and triggering
- `goose-spawn-manager-with-voice` - Enhanced spawn manager with voice support

### Performance:
- Proximity checks run at 10Hz (100ms intervals)
- Voice synthesis is non-blocking
- Minimal memory footprint with voice data cleanup

## Troubleshooting

### No Voice Audio:
1. Check browser console for speech synthesis errors
2. Ensure browser supports Web Speech API
3. Check if speech synthesis is enabled in browser settings

### Geese Not Speaking:
1. Verify `voiceEnabled:true` in spawn manager
2. Check proximity radius settings
3. Look for console errors in browser dev tools

### HUD Not Showing:
1. Check if `gooseVoiceHud` element exists in HTML
2. Verify CSS styles are not being overridden
3. Check browser console for JavaScript errors

## Future Enhancements

Potential improvements:
- 3D spatial audio positioning
- Goose-specific voice personalities
- Dynamic phrase generation based on player performance
- Voice volume based on distance
- Goose flock conversations
- Custom voice synthesis models

---

**Enjoy getting roasted by the geese!** 🦢🔥
