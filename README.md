# Vintage-Audio-Player
A beautifully crafted, responsive HTML, CSS, and JavaScript audio player with a nostalgic vintage aesthetic, packed with modern audio playback features. This project aims to replicate the charm of old-school Hi-Fi systems while providing a rich user experience for managing and enjoying your local audio files.

[Vintage Audio Player Screenshot] https://i.postimg.cc/cLP19Lmz/Vintage-Player.png

## ✨ Features

* **Nostalgic Vintage Design:** Styled to evoke the look and feel of classic audio equipment.
* **Comprehensive Metadata Display:** Utilizes `jsmediatags` to read and display ID3 tags from audio files, including Track Title, Artist, Album, and embedded Artwork.
* **Full Playback Controls:**
    * Play / Pause
    * Next Track / Previous Track
    * Shuffle Mode (toggle on/off)
    * Loop Mode (cycle through Loop Off, Loop All, Loop One Track)
* **Custom Audio Progress Bar:**
    * Visually tracks playback progress.
    * Displays elapsed and remaining time.
    * Click and drag functionality to seek through the audio.
    * Built with `div` elements for consistent cross-browser styling and animation.
* **Custom Volume Control:**
    * Smooth volume slider with a draggable knob.
    * Mute / Unmute button.
    * Also built with `div` elements for styling consistency.
* **Animated LED-Style Audio Analyzer:**
    * Full-width, highly responsive canvas-based visualizer.
    * Animated LED bars (e.g., white/red) that react to audio frequencies.
    * Bars move up fast and fall slowly for a classic effect.
* **5-Band Graphic Equalizer:**
    * Pop-up section accessible via a toggle button.
    * Five distinct frequency bands (e.g., 60Hz, 230Hz, 910Hz, 3kHz, 14kHz).
    * Custom `div`-based vertical sliders with draggable knobs for each band.
    * "Reset" button to return all bands to 0 dB.
    * "Close" button to hide the equalizer section.
* **Advanced Playlist Management:**
    * Pop-up section, appearing from the bottom (max 70% of screen height).
    * **Multiple Playlists:** Create, name, and switch between different playlists.
    * **Add Local Files:** Add audio files directly from your computer to the current playlist.
    * **Playlist Navigation:** Dropdown to select active playlist.
    * **Track Interaction:**
        * Play any track by clicking on it.
        * Delete tracks from the playlist.
        * LED indicator next to the currently playing/active track.
        * Displays track duration next to each item.
    * **Controls:** "New Playlist", "Add File", and "Hide Playlist" buttons are conveniently located at the top of the playlist section.
* **Custom Modal Notifications:** Replaces native browser `alert()` calls with a styled, non-blocking modal for a better user experience.
* **Iconography:** Uses Font Awesome for clear and stylish button icons.
* **Responsive Design:** Adapts gracefully to various screen sizes, from desktop to mobile.

---

## 🛠️ Technology Stack

* **HTML5:** Semantic structure, `<audio>` element, `<canvas>` API.
* **CSS3:** Styling, animations, transitions, Flexbox/Grid for layout, custom properties for theming potential.
* **JavaScript (ES6+):**
    * Core player logic and DOM manipulation.
    * **Web Audio API:** Used for the Equalizer (`BiquadFilterNode`) and Audio Analyzer (`AnalyserNode`).
    * Event handling for all interactive elements.
* **Libraries:**
    * **jsmediatags:** For reading ID3 metadata from audio files.
    * **Font Awesome:** For icons.

---

## 🚀 How to Use

1.  **Clone or Download:**
    * Clone the repository: `git clone https://github.com/Khandakerhub/Vintage-Audio-Player.git`
    * Or download the ZIP file and extract it.
2.  **Open in Browser:** Open the `index.html` (or your main HTML file) in a modern web browser (e.g., Chrome, Firefox, Edge, Safari).
3.  **Add Music:** Use the "Add File" button in the playlist section to load your local audio files.

*Note: As this is a client-side application, functionality like reading local files and saving playlist structures (to `localStorage`, with limitations) is handled entirely within the browser.*

---

## 🔮 Potential Future Enhancements

* More robust playlist saving (e.g., using IndexedDB for file references if File System Access API is employed).
* Drag-and-drop file adding to playlists.
* Keyboard shortcuts for playback controls.
* Theme customization options.
* Additional analyzer visualization styles.
* Saving EQ presets.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Hkandakerhub/Vintage-Audio-Player/issues) if you want to contribute.

---

## 📜 License

Apache 2.0

Made with ❤️ and a touch of nostalgia.
