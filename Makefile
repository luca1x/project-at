# --- Variables ---
PYTHON = python3
TSC = tsc
# Detect OS to open files automatically (Mac vs Linux vs Windows)
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	OPEN_CMD = open
else ifeq ($(UNAME_S),Linux)
	OPEN_CMD = xdg-open
else
	OPEN_CMD = start
endif

# --- Paths ---
DATA_DIR = data
PARSER_DIR = parser
VIS_DIR = visualization

D3_DIR = $(VIS_DIR)/d3
GOURCE_DIR = $(VIS_DIR)/groute

# --- Files ---
PARSE_SCRIPT = $(PARSER_DIR)/parse.py
FORK_SCRIPT = $(PARSER_DIR)/fork_detector.py
JSON_OUTPUT = $(DATA_DIR)/streamgraph_data.json
TS_FILE = $(D3_DIR)/d3.ts
JS_OUTPUT = $(D3_DIR)/d3.js
HTML_FILE = $(D3_DIR)/index.html
GOURCE_IMG = $(GOURCE_DIR)/gource_render.png

# --- Targets ---

.PHONY: all poster data d3 gource clean help

# Default target
all: poster

# 1. The Ultimate Command
poster: data d3 gource
	@echo "=================================================="
	@echo "🎨 POSTER ASSETS READY"
	@echo "=================================================="
	@echo "1. Streamgraph Data: Generated in $(JSON_OUTPUT)"
	@echo "2. D3 Visualization: Opening browser..."
	@$(OPEN_CMD) $(HTML_FILE)
	@echo "3. Gource: Launching simulation window. Press F12 to screenshot!"

# 2. Data Generation
data: $(JSON_OUTPUT)

$(JSON_OUTPUT): $(PARSE_SCRIPT)
	@echo "📊 Parsing Git history..."
	@mkdir -p $(DATA_DIR)
	$(PYTHON) $(PARSE_SCRIPT)

# 3. D3 Compilation (TypeScript -> JavaScript)
d3: $(JS_OUTPUT)

$(JS_OUTPUT): $(TS_FILE)
	@echo "🔨 Compiling D3 TypeScript..."
	# Assuming you have typescript installed globally or locally
	$(TSC) $(TS_FILE) --target es6 --module es2015 --outDir $(D3_DIR)

# 4. Gource Visualization
# This runs Gource with the 'High-Res Poster' settings we discussed
gource:
	@echo "🕸️ Launching Gource..."
	@echo "   (Remember: Press F12 to take a screenshot, ESC to close)"
	# Adjust --seconds-per-day if you want it faster/slower
	gource --viewport 3840x2160 \
		--transparent \
		--hide-filenames \
		--seconds-per-day 0.5 \
		--auto-skip-seconds 1 \
		--multi-sampling \
		--stop-at-end \
		--highlight-users \
		--user-image-dir $(GOURCE_DIR)/avatars \
		--output-ppm-stream - | \
		# Note: If you want to automate saving the image completely without F12, 
		# we can pipe to ffmpeg or convert, but opening the window is safer for framing.
		# For now, we just launch the window:
	gource --viewport 3840x2160 --transparent --hide-filenames --pause-at-end

# 5. Cleanup
clean:
	@echo "🧹 Cleaning up generated files..."
	rm -f $(JSON_OUTPUT)
	rm -f $(JS_OUTPUT)


forks: $(FORK_SCRIPT)
	@echo "🕵️  Calculating start dates for forks..."
	@echo "   (This may take a moment as it compares git histories)"
	@$(PYTHON) $(FORK_SCRIPT)

help:
	@echo "Usage:"
	@echo "  make poster   - Generate data, compile D3, and launch visualizations"
	@echo "  make data     - Only run the python parser"
	@echo "  make d3       - Only compile TypeScript"
	@echo "  make gource   - Only launch Gource"
	@echo "  make clean    - Remove generated data and JS files"