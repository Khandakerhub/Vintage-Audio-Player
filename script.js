document.addEventListener('DOMContentLoaded', () => {
	// --- DOM Elements ---
	const audio = document.getElementById('audio-element');
	const artwork = document.getElementById('artwork');
	const trackTitle = document.getElementById('track-title');
	const artistName = document.getElementById('artist-name');
	const albumTitle = document.getElementById('album-title');
	const currentTimeEl = document.getElementById('current-time');
	const durationEl = document.getElementById('duration');
	const progressBarContainer = document.getElementById('progress-bar-container');
	const progressBarFill = document.getElementById('progress-bar-fill');
	const progressBarKnob = document.getElementById('progress-bar-knob');
	const analyzerCanvas = document.getElementById('analyzer-canvas');
	const shuffleBtn = document.getElementById('shuffle-btn');
	const prevBtn = document.getElementById('prev-btn');
	const playPauseBtn = document.getElementById('play-pause-btn');
	const nextBtn = document.getElementById('next-btn');
	const loopBtn = document.getElementById('loop-btn');
	const eqToggleBtn = document.getElementById('eq-toggle-btn');
	const playlistToggleBtn = document.getElementById('playlist-toggle-btn');
	const muteBtn = document.getElementById('mute-btn');
	const volumeSliderContainer = document.getElementById('volume-slider-container');
	const volumeSliderFill = document.getElementById('volume-slider-fill');
	const volumeSliderKnob = document.getElementById('volume-slider-knob');
	const equalizerSection = document.getElementById('equalizer');
	const eqResetBtn = document.getElementById('eq-reset-btn');
	const eqCloseBtn = document.getElementById('eq-close-btn');
	const eqSliders = document.querySelectorAll('.eq-slider-container');
	const playlistSection = document.getElementById('playlist');
	const playlistSelect = document.getElementById('playlist-select');
	const newPlaylistBtn = document.getElementById('new-playlist-btn');
	const addFileInput = document.getElementById('add-file-input');
	const addFileBtn = document.getElementById('add-file-btn');
	const hidePlaylistBtn = document.getElementById('hide-playlist-btn');
	const playlistTracks = document.getElementById('playlist-tracks');

	// --- DOM Elements ---
	// ... (all your existing const declarations) ...
	const modalOverlay = document.getElementById('custom-modal-overlay');
	const modalMessageEl = document.getElementById('modal-message');
	const modalCloseBtn = document.getElementById('modal-close-btn');

	// --- Modal Functions ---
	function showModal(message) {
		if (modalMessageEl && modalOverlay) {
			modalMessageEl.textContent = message;
			modalOverlay.classList.add('active');
		} else {
			// Fallback to alert if modal elements aren't found for some reason
			console.error("Modal elements not found! Falling back to alert.");
			showModal(message);
		}
	}

	function hideModal() {
		if (modalOverlay) {
			modalOverlay.classList.remove('active');
		}
	}

	// --- Audio Context & Analyzer ---
	let audioContext;
	let analyser;
	let source;
	let eqBands = [];
	let dataArray;
	let canvasCtx;
	let animationFrameId;
	let lastBarHeights = []; // For smooth falling animation
	const NUM_BARS = 64; // Number of bars for the analyzer (adjust for look/performance)

	const EQ_FREQUENCIES = [60, 230, 910, 3000, 14000]; // Frequencies for 5 bands
	const GAIN_RANGE = 12; // +/- 12 dB for EQ

	// --- Player State ---
	let playlists = { 'default': [] }; // Store playlists { name: [tracks] }
	let currentPlaylistName = 'default';
	let currentTrackIndex = -1; // Start at -1, indicating nothing loaded initially
	let isPlaying = false;
	let isShuffle = false;
	let loopMode = 'none'; // 'none', 'all', 'one'
	let isDraggingProgress = false; // Specifically for progress bar drag
	let isDraggingVolume = false;   // Specifically for volume drag
	let isDraggingEq = false;       // Specifically for EQ drag

	// --- Initialization ---
	function init() {
		loadPlaylistsFromStorage(); // Load saved playlists structure
		updatePlaylistSelect();
		selectPlaylist(currentPlaylistName); // Load default or last selected playlist UI
		setupEventListeners();
		initCanvas();
		// Setup Audio Context after first user interaction (e.g., play click or file add)
		updateVolumeUI(audio.volume = 0.5); // Set initial volume slider position
		volumeSliderFill.style.width = "50%";
		updateLoopButton(); // Set initial loop icon
		updateShuffleButton(); // Set initial shuffle icon
		// Load first track metadata if available, but don't play
		if (playlists[currentPlaylistName] && playlists[currentPlaylistName].length > 0 && currentTrackIndex === -1) {
			loadTrack(0, false); // Load without autoplaying
		} else if (currentTrackIndex === -1) {
			resetPlayerUI(); // Ensure UI is reset if no tracks loaded
		}
	}

	// --- Audio Context Setup (needs user interaction) ---
	function setupAudioContext() {
		if (audioContext) return; // Already initialized
		try {
			console.log("Attempting to initialize AudioContext...");
			audioContext = new (window.AudioContext || window.webkitAudioContext)();

			// Resume context if suspended (important for browser interaction policies)
			if (audioContext.state === 'suspended') {
				audioContext.resume().then(() => console.log("AudioContext resumed."));
			}

			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256; // Power of 2 (32, 64, 128, 256, 512...)
			// analyser.smoothingTimeConstant = 0.8; // Adjust smoothing (0 to 1)

			// Create EQ Bands (Biquad Filters)
			eqBands = []; // Clear existing if re-initializing (shouldn't happen ideally)
			EQ_FREQUENCIES.forEach((freq, i) => {
				const band = audioContext.createBiquadFilter();
				band.type = 'peaking';
				band.frequency.value = freq;
				band.Q.value = 1.41; // Adjust Q factor (bandwidth) as needed (sqrt(2) is common)
				band.gain.value = 0; // Start flat
				eqBands.push(band);
			});

			source = audioContext.createMediaElementSource(audio);

			// Connect nodes: source -> EQ bands -> analyser -> destination
			let lastNode = source;
			eqBands.forEach(band => {
				lastNode.connect(band);
				lastNode = band;
			});
			lastNode.connect(analyser);
			analyser.connect(audioContext.destination);


			const bufferLength = analyser.frequencyBinCount; // == fftSize / 2
			dataArray = new Uint8Array(bufferLength);
			lastBarHeights = new Array(NUM_BARS).fill(0); // Initialize smooth fall array
			console.log("AudioContext Initialized Successfully.");
		} catch (e) {
			console.error("Error initializing AudioContext:", e);
			showModal("Could not initialize audio features. Equalizer and Analyzer may not work.");
			// Disable EQ/Analyzer features if context fails
			if (eqToggleBtn) eqToggleBtn.disabled = true;
			if (analyzerSection) analyzerSection.style.display = 'none';
		}
	}

	//document.getElementById('artwork').classList.add('rotated');
	//setInterval(function () {
	//	document.getElementById('artwork').classList.toggle('rotated');
	//}, 5000);

	// --- Canvas Initialization ---
	function initCanvas() {
		try {
			canvasCtx = analyzerCanvas.getContext('2d');
			if (!canvasCtx) throw new Error("Could not get 2D context");
			analyzerCanvas.width = analyzerCanvas.offsetWidth;
			analyzerCanvas.height = analyzerCanvas.offsetHeight;
			window.addEventListener('resize', () => { // Adjust canvas on resize
				if (analyzerCanvas && canvasCtx) {
					analyzerCanvas.width = analyzerCanvas.offsetWidth;
					analyzerCanvas.height = analyzerCanvas.offsetHeight;
					// Optionally redraw a static state or clear if not playing
					if (!isPlaying && animationFrameId) {
						canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
					}
				}
			});
		} catch (e) {
			console.error("Error initializing canvas:", e);
			if (analyzerSection) analyzerSection.style.display = 'none'; // Hide analyzer if canvas fails
		}
	}


	// --- Event Listeners ---
	function setupEventListeners() {
		console.log("Setting up event listeners..."); // General log

		// Ensure main player buttons are valid before adding listeners
		if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause); else console.error("playPauseBtn not found");
		if (prevBtn) prevBtn.addEventListener('click', playPrev); else console.error("prevBtn not found");
		if (nextBtn) nextBtn.addEventListener('click', playNext); else console.error("nextBtn not found");
		if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle); else console.error("shuffleBtn not found");
		if (loopBtn) loopBtn.addEventListener('click', cycleLoopMode); else console.error("loopBtn not found");
		if (muteBtn) muteBtn.addEventListener('click', toggleMute); else console.error("muteBtn not found");

		if (eqToggleBtn) eqToggleBtn.addEventListener('click', toggleEqualizer);
		if (playlistToggleBtn) playlistToggleBtn.addEventListener('click', togglePlaylist); else console.error("playlistToggleBtn not found");

		if (eqCloseBtn) eqCloseBtn.addEventListener('click', closeEqualizer);
		if (eqResetBtn) eqResetBtn.addEventListener('click', resetEqualizer);

		if (hidePlaylistBtn) hidePlaylistBtn.addEventListener('click', closePlaylist); else console.error("hidePlaylistBtn not found");
		if (addFileBtn) addFileBtn.addEventListener('click', () => addFileInput.click()); else console.error("addFileBtn not found");
		if (addFileInput) addFileInput.addEventListener('change', handleFileAdd); else console.error("addFileInput not found");
		if (newPlaylistBtn) newPlaylistBtn.addEventListener('click', createNewPlaylist); else console.error("newPlaylistBtn not found");
		if (playlistSelect) playlistSelect.addEventListener('change', handlePlaylistChange); else console.error("playlistSelect not found");

		if (audio) {
			audio.addEventListener('loadedmetadata', updateTimeDisplay);
			audio.addEventListener('timeupdate', updateProgress);
			audio.addEventListener('ended', handleTrackEnd);
			audio.addEventListener('error', handleAudioError);
		} else {
			console.error("Audio element not found!");
		}


		// --- MODAL EVENT LISTENERS ---
		console.log("Checking modal elements for event listeners...");
		console.log("modalCloseBtn:", modalCloseBtn); // Log the button element
		console.log("modalOverlay:", modalOverlay);   // Log the overlay element

		if (modalCloseBtn && modalOverlay) {
			console.log("Attaching click listener to modalCloseBtn."); // Confirm attachment
			modalCloseBtn.addEventListener('click', () => {
				console.log("Modal Close Button (modal-close-btn) clicked!"); // Confirm click event fires
				hideModal();
			});

			// Optional: Close modal if user clicks on the overlay backdrop
			console.log("Attaching click listener to modalOverlay for backdrop close.");
			modalOverlay.addEventListener('click', (event) => {
				if (event.target === modalOverlay) { // Check if the click is on the overlay itself
					console.log("Modal Overlay (backdrop) clicked!"); // Confirm backdrop click
					hideModal();
				}
			});
		} else {
			console.error("Modal close button or overlay not found. Listeners not attached.");
			if (!modalCloseBtn) console.error("modalCloseBtn is null or undefined.");
			if (!modalOverlay) console.error("modalOverlay is null or undefined.");
		}
		// --- END MODAL EVENT LISTENERS ---


		// -- Progress Bar Drag --
		if (progressBarContainer && progressBarFill && progressBarKnob) {
			makeDraggable(progressBarContainer, progressBarFill, progressBarKnob, (percent) => {
				if (audio.duration && !isNaN(audio.duration)) {
					const newTime = audio.duration * percent;
					audio.currentTime = newTime;
					if (currentTimeEl) currentTimeEl.textContent = formatTime(newTime);
				}
			}, isDraggingProgress);
		} else {
			console.error("Progress bar elements not found for dragging.");
		}


		// -- Volume Slider Drag --
		if (volumeSliderContainer && volumeSliderFill && volumeSliderKnob) {
			makeDraggable(volumeSliderContainer, volumeSliderFill, volumeSliderKnob, (percent) => {
				const newVolume = Math.max(0, Math.min(1, percent));
				audio.volume = newVolume;
				if (audio.muted && newVolume > 0) {
					audio.muted = false;
					updateMuteButton();
				} else if (!audio.muted && newVolume === 0) {
					audio.muted = true;
					updateMuteButton();
				}
			}, isDraggingVolume);
		} else {
			console.error("Volume slider elements not found for dragging.");
		}


		// -- EQ Slider Drag --
		if (eqSliders && eqSliders.length > 0) {
			eqSliders.forEach((slider, index) => {
				const fill = slider.querySelector('.eq-slider-fill');
				const knob = slider.querySelector('.eq-slider-knob');
				if (fill && knob) {
					makeDraggable(slider, fill, knob, (percent) => {
						if (!audioContext || !eqBands[index]) return;
						const gain = (percent - 0.5) * 2 * GAIN_RANGE;
						const clampedGain = Math.max(-GAIN_RANGE, Math.min(GAIN_RANGE, gain));
						eqBands[index].gain.setTargetAtTime(clampedGain, audioContext.currentTime, 0.015);
					}, isDraggingEq, true);
				} else {
					console.error(`EQ slider ${index} missing fill or knob.`);
				}
			});
		} else {
			// console.log("No EQ sliders found or eqSliders is null."); // Can be noisy if no EQ
		}

		// Playlist track clicks
		if (playlistTracks) {
			playlistTracks.addEventListener('click', (e) => {
				const targetLi = e.target.closest('li[data-index]');
				if (!targetLi) return;
				const index = parseInt(targetLi.dataset.index, 10);
				if (e.target.closest('.delete-track-btn')) {
					e.stopPropagation();
					deleteTrack(currentPlaylistName, index);
					return;
				}
				const playlist = playlists[currentPlaylistName];
				if (playlist && index >= 0 && index < playlist.length) {
					if (index !== currentTrackIndex || !isPlaying) {
						loadTrack(index, true);
					} else {
						togglePlayPause();
					}
				} else {
					console.warn("Clicked on invalid track index or playlist:", index, currentPlaylistName);
				}
			});
		} else {
			console.error("playlistTracks element not found.");
		}
		console.log("Event listeners setup complete.");
	}

	// --- Generic Draggable Slider Logic (Corrected) ---
	function makeDraggable(container, fill, knob, callback, isDraggingFlagRef, isVertical = false) {
		let isDragging = false;

		const getPercent = (e) => {
			const rect = container.getBoundingClientRect();
			let clientX, clientY, containerDim, containerStart, pos;

			if (e.touches && e.touches.length > 0) { // Handle touch events
				clientX = e.touches[0].clientX;
				clientY = e.touches[0].clientY;
			} else if (e.changedTouches && e.changedTouches.length > 0) { // Handle touchend
				clientX = e.changedTouches[0].clientX;
				clientY = e.changedTouches[0].clientY;
			} else {
				clientX = e.clientX;
				clientY = e.clientY;
			}

			// Check if clientX/Y are valid numbers before proceeding
			if (typeof clientX !== 'number' || typeof clientY !== 'number') {
				// console.warn("Invalid coordinates in drag event", e);
				return -1; // Indicate error or invalid position
			}

			if (isVertical) {
				containerDim = rect.height;
				containerStart = rect.bottom; // Use bottom edge for vertical 0% position
				pos = containerStart - clientY; // Calculate from bottom up
			} else {
				containerDim = rect.width;
				containerStart = rect.left;
				pos = clientX - containerStart;
			}

			if (containerDim === 0) return 0; // Avoid division by zero

			const percent = Math.max(0, Math.min(1, pos / containerDim)); // Clamp 0-1
			return percent;
		};

		// Function to update UI elements (fill, knob, text) directly during drag
		const updateUIForDrag = (percent) => {
			if (percent < 0) return; // Don't update UI if percent calculation failed

			const percentString = `${percent * 100}%`;

			if (!isVertical) { // Progress and Volume Sliders
				fill.style.width = percentString;
				if (knob) knob.style.left = percentString; // Correctly updates knob position

				// Update time text specifically for progress bar during drag
				if (container === progressBarContainer) {
					const currentTime = (audio.duration || 0) * percent;
					// Only update if the element exists
					if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);
				}
				// Update mute button for volume slider during drag
				if (container === volumeSliderContainer) {
					updateMuteButton(); // Reflect mute state changes if volume hits 0
				}
			} else { // EQ Sliders (Vertical)
				const gain = (percent - 0.5) * 2 * GAIN_RANGE;
				const clampedGain = Math.max(-GAIN_RANGE, Math.min(GAIN_RANGE, gain));
				const uiPercent = (clampedGain + GAIN_RANGE) / (2 * GAIN_RANGE); // Map gain back to 0-1 for UI
				const uiPercentString = `${uiPercent * 100}%`;

				fill.style.height = uiPercentString;
				if (knob) knob.style.bottom = uiPercentString; // EQ knobs move vertically based on bottom

				// Update gain text display
				const gainValueEl = container.parentElement.querySelector('.eq-gain-value'); // Find sibling span
				if (gainValueEl) gainValueEl.textContent = `${clampedGain.toFixed(1)} dB`;
			}
		}

		const startDrag = (e) => {
			// Only start drag on primary button click for mouse events
			if (e.button && e.button !== 0) return;

			e.preventDefault(); // Prevent default actions like text selection or page scroll on touch
			isDragging = true;

			// Update the specific flag based on the container
			if (isVertical) { isDraggingEq = true; }
			else if (container === progressBarContainer) { isDraggingProgress = true; }
			else if (container === volumeSliderContainer) { isDraggingVolume = true; }

			// Apply grabbing cursor styles immediately
			document.body.style.cursor = 'grabbing';
			if (knob) knob.style.cursor = 'grabbing';
			container.style.cursor = 'grabbing';

			document.addEventListener('mousemove', drag);
			document.addEventListener('mouseup', endDrag);
			document.addEventListener('touchmove', drag, { passive: false });
			document.addEventListener('touchend', endDrag);

			const currentPercent = getPercent(e);
			if (currentPercent >= 0) {
				updateUIForDrag(currentPercent); // Update UI immediately on click
				callback(currentPercent);      // Update underlying audio value
			}
		};

		const drag = (e) => {
			if (!isDragging) return;
			e.preventDefault(); // Prevent scrolling on touch devices during drag
			const currentPercent = getPercent(e);
			if (currentPercent >= 0) {
				updateUIForDrag(currentPercent); // Update UI continuously during drag
				callback(currentPercent);      // Update underlying audio value
			}
		};

		const endDrag = (e) => {
			if (!isDragging) return;

			// Get final position on touchend
			const finalPercent = getPercent(e);
			if (finalPercent >= 0) {
				updateUIForDrag(finalPercent); // Ensure UI reflects final position
				callback(finalPercent);      // Ensure audio value reflects final position
			}

			isDragging = false;
			// Clear the specific flag
			if (isVertical) { isDraggingEq = false; }
			else if (container === progressBarContainer) { isDraggingProgress = false; }
			else if (container === volumeSliderContainer) { isDraggingVolume = false; }

			// Restore default cursors
			document.body.style.cursor = '';
			if (knob) knob.style.cursor = 'grab';
			container.style.cursor = 'pointer';

			document.removeEventListener('mousemove', drag);
			document.removeEventListener('mouseup', endDrag);
			document.removeEventListener('touchmove', drag);
			document.removeEventListener('touchend', endDrag);

			// After dragging progress bar, trigger updateProgress to resync with actual audio time if needed
			if (container === progressBarContainer && !isDraggingProgress) {
				// Slight delay might prevent jumpiness if currentTime updated immediately
				// setTimeout(updateProgress, 10);
			}
		};

		container.addEventListener('mousedown', startDrag);
		container.addEventListener('touchstart', startDrag, { passive: false });
	}

	// --- Core Audio Controls ---
	function togglePlayPause() {
		// Ensure AudioContext is ready (important for mobile/autoplay restrictions)
		if (!audioContext) {
			setupAudioContext();
			// If context setup failed, don't try to play
			if (!audioContext) {
				console.warn("AudioContext not available, cannot play.");
				return;
			}
		}
		// Attempt to resume context if suspended
		if (audioContext.state === 'suspended') {
			audioContext.resume().then(() => {
				console.log("AudioContext resumed on interaction.");
				proceedWithPlayPause(); // Try playing again after resume
			}).catch(e => {
				console.error("Failed to resume AudioContext:", e);
				// Inform user interaction might be needed again
				showModal("Could not start audio playback automatically. Please click play again.");
			});
		} else {
			proceedWithPlayPause(); // Context is ready, proceed directly
		}
	}

	function proceedWithPlayPause() {
		const currentPlaylist = playlists[currentPlaylistName];
		if (!currentPlaylist || currentPlaylist.length === 0) {
			console.log("Playlist is empty or not selected.");
			showModal("Playlist is empty. Please add some audio files.");
			// Optionally trigger file add dialog?
			// addFileInput.click();
			return;
		}

		// Load the first track if nothing is loaded yet
		if (currentTrackIndex === -1 && currentPlaylist.length > 0) {
			loadTrack(0, false); // Load first track but don't autoplay yet
		}

		// Check if a valid track is ready to be played/paused
		if (!audio.src || currentTrackIndex === -1) {
			console.log("No valid track loaded.");
			// Try loading first track again if src is missing but index suggests it should be loaded
			if (currentPlaylist.length > 0 && currentTrackIndex === -1) loadTrack(0, false);
			return;
		}

		if (isPlaying) {
			pauseAudio();
		} else {
			playAudio();
		}
	}

	function playAudio() {
		if (!audio.src || currentTrackIndex === -1) {
			console.warn("playAudio called with no valid src or index.");
			return;
		}
		const playPromise = audio.play();

		if (playPromise !== undefined) {
			playPromise.then(() => {
				isPlaying = true;
				playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
				playPauseBtn.title = "Pause";
				startAnalyzer();
				updateActiveTrackUI();
			}).catch(error => {
				console.error("Error playing audio:", error);
				// Handle common errors like user interaction needed
				if (error.name === 'NotAllowedError') {
					showModal("Playback failed. Browser requires user interaction (like clicking play) to start audio.");
				} else if (error.name === 'NotSupportedError') {
					showModal("Audio format may not be supported by your browser.");
				} else {
					showModal(`Playback Error: ${error.message}`);
				}
				pauseAudio(); // Ensure state is consistent (paused)
			});
		}
	}

	function pauseAudio() {
		audio.pause();
		isPlaying = false;
		playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
		playPauseBtn.title = "Play";
		stopAnalyzer();
		updateActiveTrackUI(); // Update indicator even on pause
	}

	function playNext() {
		const currentPlaylist = playlists[currentPlaylistName];
		if (!currentPlaylist || currentPlaylist.length === 0) return; // No tracks to play next

		let nextIndex;
		if (isShuffle) {
			if (currentPlaylist.length <= 1) {
				nextIndex = 0; // Only one track, just replay it if shuffling
			} else {
				do {
					nextIndex = Math.floor(Math.random() * currentPlaylist.length);
				} while (nextIndex === currentTrackIndex); // Avoid same track if possible
			}
		} else {
			// Handle case where currentTrackIndex might be -1 initially
			if (currentTrackIndex === -1) nextIndex = 0;
			else nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
		}

		if (nextIndex >= 0 && nextIndex < currentPlaylist.length) {
			loadTrack(nextIndex, true); // Load and autoplay
		} else if (currentPlaylist.length > 0) {
			// Fallback: load first track if index calculation failed somehow
			loadTrack(0, true);
		}
	}

	function playPrev() {
		const currentPlaylist = playlists[currentPlaylistName];
		if (!currentPlaylist || currentPlaylist.length === 0) return; // No tracks

		// If nothing is loaded yet, load the last track (or first if desired)
		if (currentTrackIndex === -1) {
			loadTrack(currentPlaylist.length - 1, true); // Load last track and play
			return;
		}

		// Standard behavior: Restart track if > 3s played, else go to previous
		if (audio.currentTime > 3 && currentTrackIndex >= 0) {
			audio.currentTime = 0;
			if (!isPlaying) playAudio(); // Start playing if paused and restarting
		} else {
			let prevIndex;
			if (isShuffle) { // Handle shuffle previous (could just pick random again)
				if (currentPlaylist.length <= 1) {
					prevIndex = 0;
				} else {
					do {
						prevIndex = Math.floor(Math.random() * currentPlaylist.length);
					} while (prevIndex === currentTrackIndex);
				}
			} else {
				prevIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
			}

			if (prevIndex >= 0 && prevIndex < currentPlaylist.length) {
				loadTrack(prevIndex, true); // Load and autoplay
			}
		}
	}

	function toggleShuffle() {
		isShuffle = !isShuffle;
		updateShuffleButton();
		console.log("Shuffle:", isShuffle);
	}

	function updateShuffleButton() {
		shuffleBtn.classList.toggle('active', isShuffle);
		shuffleBtn.title = isShuffle ? "Shuffle On" : "Shuffle Off";
	}


	function cycleLoopMode() {
		if (loopMode === 'none') loopMode = 'all';
		else if (loopMode === 'all') loopMode = 'one';
		else loopMode = 'none';
		updateLoopButton();
		console.log("Loop Mode:", loopMode);
	}

	function updateLoopButton() {
		audio.loop = (loopMode === 'one'); // HTMLAudioElement loop only handles single track loop

		loopBtn.classList.remove('active'); // Remove active class initially
		let iconClass = 'fas fa-rotate-right'; // Default: loop off / all
		let title = 'Loop Off';

		if (loopMode === 'one') {
			// Font Awesome 6 uses fa-repeat for loop one
			iconClass = 'fas fa-repeat';
			title = 'Loop One';
			loopBtn.classList.add('active'); // Active state for loop one
		} else if (loopMode === 'all') {
			iconClass = 'fas fa-sync'; // Keep sync icon for loop all
			title = 'Loop All';
			loopBtn.classList.add('active'); // Active state for loop all
		}
		loopBtn.innerHTML = `<i class="${iconClass}"></i>`;
		loopBtn.title = title;
	}

	function toggleMute() {
		audio.muted = !audio.muted;
		updateMuteButton();
		// Update slider UI to reflect mute state (optional: show 0 when muted)
		// updateVolumeUI(audio.muted ? 0 : audio.volume);
		updateVolumeUI(audio.volume); // Keep slider showing actual volume level
	}

	function updateMuteButton() {
		if (audio.muted) {
			muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
			muteBtn.title = 'Unmute';
			muteBtn.classList.add('active'); // Visually indicate muted
		} else {
			muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
			muteBtn.title = 'Mute';
			muteBtn.classList.remove('active');
		}
	}

	function updateVolumeUI(volume) {
		// Called by volume change events or mute toggle
		const percent = volume * 100;
		volumeSliderFill.style.width = `${percent}%`;
		volumeSliderKnob.style.left = `${percent}%`; // Set knob's left edge
		// Mute button update is handled by toggleMute or the drag callback directly
		// updateMuteButton(); // Can call here too for safety
	}


	// --- Progress & Time ---
	function updateTimeDisplay() {
		// Called on 'loadedmetadata'
		const duration = audio.duration;
		if (!isNaN(duration) && duration > 0) {
			durationEl.textContent = formatTime(duration);
			// Update progress bar immediately in case metadata loaded after track start
			updateProgress();
		} else {
			durationEl.textContent = '--:--'; // Show placeholder if duration not ready
		}
	}

	function updateProgress() {
		// Called on 'timeupdate'
		if (isDraggingProgress) return; // Don't update based on timeupdate if dragging

		const currentTime = audio.currentTime;
		const duration = audio.duration;

		if (!isNaN(currentTime)) {
			currentTimeEl.textContent = formatTime(currentTime);
		} else {
			currentTimeEl.textContent = '0:00';
		}

		if (duration && !isNaN(duration) && duration > 0) {
			const percent = (currentTime / duration) * 100;
			progressBarFill.style.width = `${percent}%`;
			progressBarKnob.style.left = `${percent}%`; // Set knob's left edge
		} else {
			// Reset progress if duration is invalid or zero (and not dragging)
			progressBarFill.style.width = '0%';
			progressBarKnob.style.left = '0%';
			if (durationEl.textContent === '0:00' || durationEl.textContent === '--:--') {
				durationEl.textContent = '--:--'; // Keep or set placeholder
			}
		}
	}


	function formatTime(seconds) {
		if (isNaN(seconds) || seconds < 0) return '--:--';
		const minutes = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
	}

	// --- Track Loading & Metadata ---
	function loadTrack(index, autoPlay = false) {
		const playlist = playlists[currentPlaylistName];
		if (!playlist || index < 0 || index >= playlist.length) {
			console.warn(`Invalid track index ${index} for playlist ${currentPlaylistName}. Resetting.`);
			resetPlayerUI();
			return;
		}

		const track = playlist[index];
		if (!track || !track.src) {
			console.error(`Track data or source missing for index ${index} in playlist ${currentPlaylistName}`);
			showModal(`Error: Could not load track ${index + 1}. Audio source might be invalid or missing. Please try re-adding the file.`);
			// Remove the faulty track?
			// deleteTrack(currentPlaylistName, index); // Be careful with recursive calls or UI updates here
			resetPlayerUI(); // Reset to avoid broken state
			return;
		}

		console.log(`Loading track ${index}: ${track.name || 'Unknown'}`);
		currentTrackIndex = index; // Update index *before* setting src

		// --- Update Metadata UI ---
		trackTitle.textContent = track.name || 'Unknown Track';
		artistName.textContent = track.artist || 'Unknown Artist';
		albumTitle.textContent = track.album || 'Unknown Album';
		artwork.src = track.artworkDataUrl || 'https://i.postimg.cc/VvLYxh6Y/Gramophone-Disk.png'; // Use stored data URL or placeholder

		// Reset time/progress displays before loading new track
		currentTimeEl.textContent = '0:00';
		durationEl.textContent = track.duration && track.duration !== '--:--' ? track.duration : '0:00'; // Show known duration or reset
		progressBarFill.style.width = '0%';
		progressBarKnob.style.left = '0%';

		// --- Set Audio Source and Load ---
		try {
			// Check if src is still valid (Blob URLs can expire) - This check is difficult/unreliable
			// For simplicity, we assume the src is valid if it exists. Errors handled by 'error' event.
			audio.src = track.src;
			audio.load(); // Explicitly call load after changing src
			console.log("Audio source set and load() called.");
		} catch (e) {
			console.error("Error setting audio source:", e);
			showModal(`Could not load audio source for "${track.name}". It might be invalid or expired.`);
			resetPlayerUI();
			return;
		}

		// Update loop setting (important if loopMode is 'one')
		audio.loop = (loopMode === 'one');

		// Handle Autoplay (attempt only if requested)
		if (autoPlay) {
			console.log("Attempting autoplay...");
			if (!audioContext) setupAudioContext(); // Ensure context is ready

			const playAttempt = () => {
				if (audioContext && audioContext.state === 'running') {
					playAudio();
				} else if (audioContext && audioContext.state === 'suspended') {
					console.log("AudioContext suspended, resuming for autoplay...");
					audioContext.resume().then(playAudio).catch(e => {
						console.error("Resume failed for autoplay:", e);
						pauseAudio(); // Ensure UI is paused if resume failed
					});
				} else {
					console.warn("Cannot autoplay, AudioContext not ready or failed.");
					pauseAudio(); // Ensure UI is paused
				}
			};
			// Add a slight delay? Sometimes helps browsers initiate play after load
			setTimeout(playAttempt, 50);
		} else {
			// If not autoplaying, ensure player state is visually paused
			// Don't call audio.pause() here, just update UI state
			isPlaying = false;
			playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
			playPauseBtn.title = "Play";
			stopAnalyzer(); // Ensure analyzer is stopped if not autoplaying
		}

		updateActiveTrackUI(); // Highlight the newly loaded track in the list
	}

	// --- Reset Player UI ---
	function resetPlayerUI() {
		pauseAudio(); // Ensure playback stops and UI reflects pause
		audio.removeAttribute('src'); // Clear source
		audio.load(); // Important: call load() after removing src to stop buffering etc.
		currentTrackIndex = -1;
		trackTitle.textContent = 'Track Title';
		artistName.textContent = 'Artist Name';
		albumTitle.textContent = 'Album Title';
		artwork.src = 'https://i.postimg.cc/VvLYxh6Y/Gramophone-Disk.png';
		currentTimeEl.textContent = '0:00';
		durationEl.textContent = '0:00';
		progressBarFill.style.width = '0%';
		progressBarKnob.style.left = '0%';
		updateActiveTrackUI(); // Remove highlight from playlist
		stopAnalyzer(); // Ensure analyzer stops and clears
		if (canvasCtx) canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
	}


	// --- jsmediatags Integration ---
	function readMediaTags(file, callback) {
		if (!window.jsmediatags) {
			console.error("jsmediatags library not loaded.");
			callback({ title: null, artist: null, album: null, artworkDataUrl: null });
			return;
		}

		window.jsmediatags.read(file, {
			onSuccess: function (tag) {
				const tags = tag.tags;
				let artworkDataUrl = null;

				if (tags.picture) {
					try {
						const { data, format } = tags.picture;
						// Efficient base64 conversion using Uint8Array and btoa
						const uint8Array = new Uint8Array(data);
						const CHUNK_SIZE = 8192; // Process in chunks to avoid stack limits
						let binaryString = '';
						for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
							binaryString += String.fromCharCode.apply(null, uint8Array.subarray(i, i + CHUNK_SIZE));
						}
						// const binaryString = String.fromCharCode.apply(null, uint8Array); // Might fail for large images
						const base64String = btoa(binaryString);
						artworkDataUrl = `data:${format};base64,${base64String}`;
					} catch (e) {
						console.warn("Error processing artwork data:", e);
					}
				}

				callback({
					title: tags.title,
					artist: tags.artist,
					album: tags.album,
					artworkDataUrl: artworkDataUrl
				});
			},
			onError: function (error) {
				console.warn('jsmediatags Error reading tags:', error.type, error.info);
				callback({ title: null, artist: null, album: null, artworkDataUrl: null });
			}
		});
	}


	// --- Track Ending ---
	function handleTrackEnd() {
		console.log("Track ended");
		const currentPlaylist = playlists[currentPlaylistName];
		if (!currentPlaylist || currentPlaylist.length === 0) return;

		if (loopMode === 'one') {
			// audio.loop = true should handle this, but just in case:
			audio.currentTime = 0;
			playAudio(); // Ensure playback continues
		} else if (loopMode === 'all') {
			playNext(); // Play next track (wraps around)
		} else if (loopMode === 'none') {
			// Check if it was the last track
			if (currentTrackIndex >= currentPlaylist.length - 1) { // >= handles potential index issues
				// End of playlist reached, no loop: Stop playback, reset time
				pauseAudio();
				audio.currentTime = 0; // Reset time for next play
				updateProgress(); // Update UI to show 0:00
				// Keep last track highlighted until user acts
				console.log("End of playlist reached.");
			} else {
				// Not the last track, play next even if loop is none
				playNext();
			}
		}
	}

	// --- Audio Error Handling ---
	function handleAudioError(e) {
		console.error("Audio Element Error:", e);
		let message = "An unknown audio error occurred.";
		const trackName = currentTrackIndex >= 0 ? playlists[currentPlaylistName]?.[currentTrackIndex]?.name : 'the current track';
		if (audio.error) {
			switch (audio.error.code) {
				case MediaError.MEDIA_ERR_ABORTED:
					message = `Playback aborted for "${trackName}".`;
					// Often user initiated, maybe don't alert?
					console.warn(message);
					break;
				case MediaError.MEDIA_ERR_NETWORK:
					message = `A network error prevented loading "${trackName}". Check connection?`;
					showModal(`Audio Error: ${message}`);
					break;
				case MediaError.MEDIA_ERR_DECODE:
					message = `The audio for "${trackName}" could not be decoded. File might be corrupt or unsupported.`;
					showModal(`Audio Error: ${message}`);
					break;
				case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
					message = `The audio format for "${trackName}" is not supported by your browser.`;
					showModal(`Audio Error: ${message}`);
					break;
				default:
					message = `An error occurred playing "${trackName}" (Code ${audio.error.code})`;
					showModal(`Audio Error: ${message}`);
			}
		} else {
			showModal(`Audio Error: ${message}`); // Generic error if details missing
		}
		// Try to recover or inform user
		resetPlayerUI(); // Reset UI to a safe state after error
		// Maybe try loading next track automatically? Risky if error is format-related.
		// setTimeout(playNext, 1000);
	}


	// --- Canvas Initialization ---
	function initCanvas() {
		try {
			canvasCtx = analyzerCanvas.getContext('2d');
			if (!canvasCtx) throw new Error("Could not get 2D context");

			const setInitialSize = () => {
				analyzerCanvas.width = analyzerCanvas.offsetWidth;
				analyzerCanvas.height = analyzerCanvas.offsetHeight;
				console.log(`Canvas initial dimensions: ${analyzerCanvas.width}x${analyzerCanvas.height}`);
				// Initialize lastBarHeights array ONLY after width is known and > 0
				if (analyzerCanvas.width > 0) {
					lastBarHeights = new Array(NUM_BARS).fill(0);
				} else {
					// Retry setting size if width is still 0? Or wait for resize.
					console.warn("Canvas width is 0 on init, retrying soon...");
					setTimeout(setInitialSize, 100); // Retry after 100ms
				}
			};
			// Use timeout 0 to run after initial render flow
			setTimeout(setInitialSize, 0);

			// Resize listener
			window.addEventListener('resize', () => {
				if (analyzerCanvas && canvasCtx) {
					analyzerCanvas.width = analyzerCanvas.offsetWidth;
					analyzerCanvas.height = analyzerCanvas.offsetHeight;
					console.log(`Canvas resized dimensions: ${analyzerCanvas.width}x${analyzerCanvas.height}`);
					// Re-initialize if width was previously 0 or size changed significantly
					if (analyzerCanvas.width > 0) {
						lastBarHeights = new Array(NUM_BARS).fill(0);
					}
					if (!isPlaying && animationFrameId === null) {
						canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
					}
				}
			});
		} catch (e) { /* ... error handling ... */ }
	}

	// --- Analyzer Visualization ---
	function drawAnalyzer() {
		// Check prerequisites more robustly
		if (!isPlaying || !audioContext || audioContext.state !== 'running' || !analyser || !canvasCtx || !dataArray) {
			stopAnalyzer(); // Ensure it stops if conditions aren't met
			return;
		}

		animationFrameId = requestAnimationFrame(drawAnalyzer); // Keep the loop going

		analyser.getByteFrequencyData(dataArray); // Get current frequency data

		const canvasWidth = analyzerCanvas.width;
		const canvasHeight = analyzerCanvas.height;

		canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear canvas

		// --- CORRECTED Bar Width and Spacing Calculation ---
		const spacing = 1; // Pixels of gap between bars (set to 0 for touching bars)
		const totalSpacing = Math.max(0, (NUM_BARS - 1)) * spacing; // Total space used by gaps
		const availableWidthForBars = canvasWidth - totalSpacing; // Width available for the bars themselves
		const barWidth = Math.max(1, availableWidthForBars / NUM_BARS); // Calculate width per bar, ensure it's at least 1px
		let x = 0; // Starting x position
		// --- End Corrected Calculation ---

		const heightScale = canvasHeight / 255; // Scale data (0-255) to canvas height
		const fallSpeed = 3; // Pixels to fall per frame
		const riseSpeed = 15; // Max pixels to rise per frame

		for (let i = 0; i < NUM_BARS; i++) {
			// Pick spaced frequency bins
			const dataIndex = Math.floor(i * (dataArray.length / NUM_BARS));
			let barHeight = dataArray[dataIndex] * heightScale;

			// --- Smooth Fall / Capped Rise Animation ---
			if (barHeight < lastBarHeights[i]) {
				lastBarHeights[i] = Math.max(0, barHeight, lastBarHeights[i] - fallSpeed); // Fall, but not below 0 or current height
			} else {
				// Rise quickly, but cap the jump per frame
				lastBarHeights[i] = Math.min(barHeight, lastBarHeights[i] + riseSpeed);
			}
			// Ensure effectiveHeight isn't NaN or negative if lastBarHeights wasn't initialized properly
			const effectiveHeight = Math.max(0, lastBarHeights[i] || 0);
			// --- End Animation Logic ---

			// --- Color Logic (remains the same) ---
			const redThreshold = canvasHeight * 0.75;
			const peakThreshold = canvasHeight * 0.9;
			let fillStyle = '#ffffff'; // Default White
			if (effectiveHeight > redThreshold) {
				const intensity = Math.min(1, (effectiveHeight - redThreshold) / (canvasHeight - redThreshold));
				if (effectiveHeight > peakThreshold) {
					const peakIntensity = Math.min(1, (effectiveHeight - peakThreshold) / (canvasHeight - peakThreshold));
					const r = Math.round(255 + (231 - 255) * peakIntensity);
					const g = Math.round(255 + (76 - 255) * peakIntensity);
					const b = Math.round(255 + (60 - 255) * peakIntensity);
					fillStyle = `rgb(${r}, ${g}, ${b})`;
				} else {
					const r = 255;
					const g = Math.round(255 + (107 - 255) * intensity);
					const b = Math.round(255 + (107 - 255) * intensity);
					fillStyle = `rgb(${r}, ${g}, ${b})`;
				}
			}
			canvasCtx.fillStyle = fillStyle;
			// --- End Color Logic ---

			// Draw the bar (ensure height is visible if > 0)
			if (effectiveHeight > 0) {
				// Using Math.floor on x and width can prevent sub-pixel rendering artifacts sometimes
				canvasCtx.fillRect(Math.floor(x), canvasHeight - effectiveHeight, Math.floor(barWidth), Math.max(1, effectiveHeight));
			}

			// --- Update x position for the next bar ---
			x += barWidth + spacing;
		}
	}

	function startAnalyzer() {
		if (!audioContext || audioContext.state !== 'running' || !analyser || !canvasCtx) {
			return; // Prerequisites not met
		}
		if (animationFrameId) return; // Already running
		if (isPlaying) { // Only start if actually playing
			console.log("Starting Analyzer");
			drawAnalyzer(); // Start the animation loop
		}
	}

	function stopAnalyzer() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
			console.log("Stopping Analyzer");
			// Clear canvas when stopped explicitly
			if (canvasCtx) {
				// Delay clear slightly to avoid flicker if immediately restarting
				setTimeout(() => {
					if (!isPlaying && canvasCtx && !animationFrameId) { // Check again if still stopped
						canvasCtx.clearRect(0, 0, analyzerCanvas.width, analyzerCanvas.height);
					}
				}, 50);
			}
		}
	}


	// --- Equalizer Controls ---
	function toggleEqualizer() {
		if (!audioContext) {
			showModal("Audio features not ready. Play a track first.");
			return;
		}
		equalizerSection.classList.toggle('active');
		// Hide playlist if opening EQ
		if (equalizerSection.classList.contains('active')) {
			closePlaylist();
		}
	}
	function closeEqualizer() {
		equalizerSection.classList.remove('active');
	}

	function setEqGain(bandIndex, gain) {
		// This function is now primarily used by resetEqualizer
		// Dragging updates gain via the makeDraggable callback directly
		if (eqBands && eqBands[bandIndex]) {
			const clampedGain = Math.max(-GAIN_RANGE, Math.min(GAIN_RANGE, gain));
			eqBands[bandIndex].gain.value = clampedGain; // Direct change for reset

			// Update UI to reflect the change
			const slider = eqSliders[bandIndex];
			const fill = slider.querySelector('.eq-slider-fill');
			const knob = slider.querySelector('.eq-slider-knob');
			const gainValueEl = slider.parentElement.querySelector('.eq-gain-value'); // Find sibling span

			const uiPercent = (clampedGain + GAIN_RANGE) / (2 * GAIN_RANGE);
			const uiPercentString = `${uiPercent * 100}%`;

			fill.style.height = uiPercentString;
			if (knob) knob.style.bottom = uiPercentString;
			if (gainValueEl) gainValueEl.textContent = `${clampedGain.toFixed(1)} dB`;
		}
	}

	function resetEqualizer() {
		if (!audioContext) return; // Don't reset if context not ready
		eqBands.forEach((band, index) => {
			// Use setTargetAtTime for smooth reset? Or instant? Instant is simpler.
			// band.gain.setTargetAtTime(0, audioContext.currentTime, 0.05); // Smooth reset over 50ms
			setEqGain(index, 0); // Call our combined function for instant reset + UI update
		});
	}


	// --- Playlist Management ---
	function togglePlaylist() {
		playlistSection.classList.toggle('active');
		// Hide EQ if opening Playlist
		if (playlistSection.classList.contains('active')) {
			closeEqualizer();
		}
	}
	function closePlaylist() {
		playlistSection.classList.remove('active');
	}

	function handleFileAdd(event) {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		// Ensure context is ready before processing files that might need duration check
		if (!audioContext) setupAudioContext();

		const currentPlaylist = playlists[currentPlaylistName];
		if (!currentPlaylist) {
			console.error("Cannot add files: Current playlist not found:", currentPlaylistName);
			showModal("Error: Could not find the current playlist to add files to.");
			return;
		}

		let filesProcessed = 0;
		let tracksAdded = 0;
		const totalFiles = files.length;

		console.log(`Processing ${totalFiles} files...`);
		// Consider adding a visual "loading..." state to the playlist area

		for (const file of files) {
			if (file.type.startsWith('audio/')) {
				// Create Blob URL immediately
				let fileSrc = null;
				try {
					fileSrc = URL.createObjectURL(file);
				} catch (e) {
					console.error("Error creating Object URL for file:", file.name, e);
					filesProcessed++;
					finalizeProcessingCheck(filesProcessed, totalFiles, tracksAdded);
					continue; // Skip this file
				}

				// Use jsmediatags to get metadata
				readMediaTags(file, (tags) => {
					// Use a temporary audio element to get duration reliably
					const tempAudio = new Audio();
					tempAudio.preload = 'metadata';
					let duration = NaN;
					let processed = false; // Flag to prevent double processing

					const processTrackData = () => {
						if (processed) return; // Already handled (e.g., by error)
						processed = true;

						duration = tempAudio.duration;
						// Clean up the temporary audio element and revoke its *temporary* URL if needed
						tempAudio.removeAttribute('src');
						tempAudio.load();

						const newTrack = {
							name: tags.title || file.name.replace(/\.[^/.]+$/, ""),
							artist: tags.artist || 'Unknown Artist',
							album: tags.album || 'Unknown Album',
							src: fileSrc, // Store the persistent blob URL created earlier
							duration: formatTime(duration),
							artworkDataUrl: tags.artworkDataUrl || null,
						};

						currentPlaylist.push(newTrack);
						tracksAdded++;
						filesProcessed++;
						finalizeProcessingCheck(filesProcessed, totalFiles, tracksAdded);
					};

					// Set up listeners *before* setting src
					tempAudio.addEventListener('loadedmetadata', processTrackData, { once: true });
					tempAudio.addEventListener('error', (e) => {
						console.warn(`Could not get duration via temp audio for ${file.name}`, e);
						duration = NaN;
						processTrackData(); // Process track even without duration
					}, { once: true });

					// Set src to trigger loading
					tempAudio.src = fileSrc;

					// Timeout fallback in case loadedmetadata never fires
					setTimeout(() => {
						if (!processed) {
							console.warn(`Timeout waiting for metadata of ${file.name}`);
							duration = NaN;
							processTrackData(); // Process track after timeout
						}
					}, 5000); // 5 second timeout per track

				}); // End readMediaTags callback

			} else {
				console.warn(`Skipping non-audio file: ${file.name}`);
				filesProcessed++;
				finalizeProcessingCheck(filesProcessed, totalFiles, tracksAdded);
			}
		}
		// Reset file input to allow adding the same file(s) again later
		addFileInput.value = '';
	}

	function finalizeProcessingCheck(processed, total, added) {
		// Update UI and save after all selected files have been attempted
		if (processed === total) {
			console.log(`Finished processing ${total} files, added ${added} tracks.`);
			// Remove loading indicator here if one was added
			if (added > 0) {
				renderPlaylist(currentPlaylistName); // Update UI
				savePlaylistsToStorage();      // Persist (metadata)
				// If player was empty and files were added, load the first track
				if (currentTrackIndex === -1 && playlists[currentPlaylistName].length > 0) {
					loadTrack(0, false); // Load first track without autoplay
				}
			}
			if (processed > 0 && added === 0) {
				showModal("No compatible audio files were found among the selected items.");
			}
		}
	}

	function renderPlaylist(playlistName) {
		const playlist = playlists[playlistName];
		playlistTracks.innerHTML = ''; // Clear existing list

		if (!playlist) {
			console.error(`Playlist "${playlistName}" not found for rendering.`);
			// Optionally display an error message in the list area
			// playlistTracks.innerHTML = '<li class="error">Error: Playlist not found.</li>';
			return;
		}

		if (playlist.length > 0) {
			playlist.forEach((track, index) => {
				const li = document.createElement('li');
				// Store index, src might not be needed if we always load by index
				li.dataset.index = index;

				// Add active class handled by updateActiveTrackUI

				li.innerHTML = `
											<span class="track-led"></span>
											<span class="track-info">${track.name || 'Unknown Track'} - ${track.artist || 'Unknown Artist'}</span>
											<span class="track-duration">${track.duration || '--:--'}</span>
											<button class="delete-track-btn" title="Remove"><i class="fas fa-trash"></i></button>
									`;
				playlistTracks.appendChild(li);
			});
		}
		// Else: The :empty CSS pseudo-class will show the placeholder text

		// Update active track highlighting after rendering
		updateActiveTrackUI();
	}

	function updateActiveTrackUI() {
		const tracks = playlistTracks.querySelectorAll('li');
		// No need to check playlist name equality here, renderPlaylist ensures list is correct
		tracks.forEach((li) => {
			const index = parseInt(li.dataset.index, 10);
			const isActive = (index === currentTrackIndex); // Check if index matches current

			li.classList.toggle('active', isActive); // Add/remove 'active' class on the LI

			// Update LED style specifically if this LI is the active one
			const led = li.querySelector('.track-led');
			if (led) { // Ensure LED element exists
				if (isActive) {
					// Green if playing, Yellow if paused but loaded
					led.style.backgroundColor = isPlaying ? '#39ff14' : '#f9ca24';
					led.style.boxShadow = isPlaying ? '0 0 5px #39ff14' : '0 0 5px #f9ca24';
				} else {
					// Reset to default styles if not active (rely on CSS)
					led.style.backgroundColor = '';
					led.style.boxShadow = '';
				}
			}
		});
	}


	function deleteTrack(playlistName, indexToDelete) {
		const playlist = playlists[playlistName];
		if (!playlist || indexToDelete < 0 || indexToDelete >= playlist.length) {
			console.error("Invalid index or playlist for deletion.");
			return;
		}

		// Confirmation dialog (optional but recommended)
		if (!confirm(`Are you sure you want to remove "${playlist[indexToDelete].name || 'this track'}"?`)) {
			return;
		}

		const deletedTrack = playlist.splice(indexToDelete, 1)[0]; // Remove track from array
		console.log(`Deleted track ${indexToDelete} ("${deletedTrack?.name}") from ${playlistName}`);

		// Revoke Object URL if it exists and seems valid
		if (deletedTrack && deletedTrack.src && typeof deletedTrack.src === 'string' && deletedTrack.src.startsWith('blob:')) {
			try {
				URL.revokeObjectURL(deletedTrack.src);
				console.log("Revoked Object URL for deleted track:", deletedTrack.src);
			} catch (e) {
				console.warn("Could not revoke Object URL:", e);
			}
		}

		// --- Adjust playback state ---
		if (playlistName === currentPlaylistName) { // Only adjust if deleting from active list
			if (playlist.length === 0) { // Playlist is now empty
				resetPlayerUI();
			} else if (indexToDelete === currentTrackIndex) {
				// If the deleted track *was* the current one
				// Stop playback, load the track that now has the same index (or the new last track if it was last)
				pauseAudio(); // Stop first
				// Important: Update index *after* splice, find the new track at the potentially same index
				currentTrackIndex = Math.min(indexToDelete, playlist.length - 1);
				// Set the index to -1 temporarily to ensure loadTrack reloads correctly if index didn't change
				const tempIndex = currentTrackIndex;
				currentTrackIndex = -1;
				loadTrack(tempIndex, false); // Load new track without autoplay

			} else if (indexToDelete < currentTrackIndex) {
				// If a track *before* the current one was deleted, decrement current index
				currentTrackIndex--;
				// No need to reload track, just ensure active UI updates correctly via renderPlaylist
			}
			// No index change needed if a track *after* the current one was deleted
		}
		// --- End playback adjustment ---

		renderPlaylist(playlistName); // Re-render the updated playlist (this calls updateActiveTrackUI)
		savePlaylistsToStorage();
	}

	function createNewPlaylist() {
		const newName = prompt("Enter name for the new playlist:");
		if (newName && newName.trim() !== "") {
			const trimmedName = newName.trim();
			if (!playlists[trimmedName]) {
				playlists[trimmedName] = []; // Create new empty array
				updatePlaylistSelect();       // Update dropdown before selecting
				playlistSelect.value = trimmedName; // Select new playlist in dropdown
				// Manually trigger the change handler to switch context
				handlePlaylistChange();
				// savePlaylistsToStorage(); // Called within selectPlaylist via handlePlaylistChange
				// Open the playlist view?
				if (!playlistSection.classList.contains('active')) {
					togglePlaylist();
				}
			} else {
				showModal("A playlist with that name already exists.");
			}
		} else if (newName !== null) { // User didn't cancel, but entered empty name
			showModal("Playlist name cannot be empty.");
		}
	}

	function handlePlaylistChange() {
		// Called when user selects from dropdown
		const selectedName = playlistSelect.value;
		selectPlaylist(selectedName);
	}

	function selectPlaylist(playlistName) {
		// Called internally or by change handler
		if (playlists[playlistName] === undefined) {
			console.warn(`Attempted to select non-existent playlist: ${playlistName}. Falling back to default.`);
			playlistName = 'default';
			if (playlists['default'] === undefined) playlists['default'] = []; // Ensure default exists
			playlistSelect.value = 'default'; // Update dropdown if fallback occurred
		}

		// Only proceed if playlist actually changed or nothing is loaded yet
		if (currentPlaylistName !== playlistName || currentTrackIndex === -1) {
			console.log(`Switching to playlist: ${playlistName}`);
			currentPlaylistName = playlistName; // Update state FIRST
			resetPlayerUI(); // Clear current state before loading new list

			renderPlaylist(currentPlaylistName); // Display the tracks of the new playlist

			// Load the first track metadata automatically, but don't autoplay
			const currentPlaylist = playlists[currentPlaylistName];
			if (currentPlaylist && currentPlaylist.length > 0) {
				loadTrack(0, false); // Load first track without autoplay
			} else {
				// If switching to an empty playlist, resetPlayerUI already handled clearing
				updateActiveTrackUI(); // Ensure no active track shown
			}
			savePlaylistsToStorage(); // Save the last selected playlist name
		}
	}

	function updatePlaylistSelect() {
		// Updates the options in the dropdown based on the playlists object
		const currentlySelectedValue = playlistSelect.value; // Remember what user sees selected
		let listHasChanged = false; // Flag to see if we need to re-sync selection
		const currentOptions = Array.from(playlistSelect.options).map(opt => opt.value);
		const playlistKeys = Object.keys(playlists);

		// Add new playlists
		playlistKeys.forEach(name => {
			if (!currentOptions.includes(name)) {
				const option = document.createElement('option');
				option.value = name;
				option.textContent = name;
				playlistSelect.appendChild(option);
				listHasChanged = true;
			}
		});

		// Remove deleted playlists
		currentOptions.forEach(name => {
			if (!playlistKeys.includes(name)) {
				const optionToRemove = playlistSelect.querySelector(`option[value="${name}"]`);
				if (optionToRemove) {
					playlistSelect.removeChild(optionToRemove);
					listHasChanged = true;
				}
			}
		});

		// Ensure the correct playlist is selected visually
		if (listHasChanged || playlistSelect.value !== currentPlaylistName) {
			if (playlists[currentPlaylistName]) { // Does the target playlist exist?
				playlistSelect.value = currentPlaylistName;
			} else if (playlists[currentlySelectedValue]) { // Does the previously visible one still exist?
				playlistSelect.value = currentlySelectedValue;
				currentPlaylistName = currentlySelectedValue; // Sync state back if needed
			} else { // Fallback to default if both current and previous are gone
				currentPlaylistName = 'default';
				if (!playlists['default']) playlists['default'] = []; // Ensure default exists in data
				if (!playlistSelect.querySelector('option[value="default"]')) { // Add default option if missing
					const option = document.createElement('option');
					option.value = 'default'; option.textContent = 'Default Playlist';
					playlistSelect.appendChild(option);
				}
				playlistSelect.value = 'default';
			}
		}
	}


	// --- Local Storage Persistence ---
	function savePlaylistsToStorage() {
		// Saves only metadata. Blob URLs (track.src) are NOT saved.
		const playlistsToSave = {};
		for (const name in playlists) {
			// Basic check if it's an array before mapping
			if (Array.isArray(playlists[name])) {
				playlistsToSave[name] = playlists[name].map(track => ({
					name: track.name,
					artist: track.artist,
					album: track.album,
					duration: track.duration,
					artworkDataUrl: track.artworkDataUrl // Saving artwork can significantly increase storage usage
				}));
			} else {
				console.warn(`Item "${name}" in playlists object is not an array, skipping save.`);
			}
		}

		try {
			// Use a versioned key to allow for future data structure changes
			localStorage.setItem('vintageAudioPlayerPlaylists_v2', JSON.stringify(playlistsToSave));
			localStorage.setItem('vintageAudioPlayerLastPlaylist_v2', currentPlaylistName);
		} catch (e) {
			console.error("Error saving playlists to localStorage:", e);
			// Inform user storage might be full or disabled
			showModal("Could not save playlist data. Local storage might be full or disabled in your browser settings.");
		}
	}

	function loadPlaylistsFromStorage() {
		const savedPlaylistsJSON = localStorage.getItem('vintageAudioPlayerPlaylists_v2');
		const lastPlaylistName = localStorage.getItem('vintageAudioPlayerLastPlaylist_v2');
		let loadedData = null;

		if (savedPlaylistsJSON) {
			try {
				loadedData = JSON.parse(savedPlaylistsJSON);
				// Restore playlist structure - start fresh before populating
				playlists = {};
				for (const name in loadedData) {
					// Validate that the loaded item is an array before processing
					if (Array.isArray(loadedData[name])) {
						playlists[name] = loadedData[name].map(trackData => ({
							name: trackData.name || 'Unknown Track',
							artist: trackData.artist || 'Unknown Artist',
							album: trackData.album || 'Unknown Album',
							duration: trackData.duration || '--:--',
							artworkDataUrl: trackData.artworkDataUrl || null,
							src: null, // ** Important: src MUST be null initially **
						}));
					} else {
						console.warn(`Loaded data for "${name}" is not an array, skipping.`);
					}
				}
				console.log("Loaded playlists structure from localStorage.");
			} catch (e) {
				console.error("Error parsing playlists from localStorage:", e);
				// Clear corrupted data and reset to default
				playlists = { 'default': [] };
				localStorage.removeItem('vintageAudioPlayerPlaylists_v2');
				localStorage.removeItem('vintageAudioPlayerLastPlaylist_v2');
				showModal("Could not load saved playlists (data might be corrupted). Resetting to default.");
			}
		} else {
			// No saved data, initialize with default
			playlists = { 'default': [] };
		}

		// Ensure the default playlist always exists in the playlists object
		if (!playlists['default']) {
			playlists['default'] = [];
		}

		// Set the current playlist name: use last saved if valid, otherwise default
		currentPlaylistName = (lastPlaylistName && playlists[lastPlaylistName]) ? lastPlaylistName : 'default';
	}

	// --- Start the application ---
	init();
});