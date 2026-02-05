# --- Variables ---
PYTHON = python3
TSC = tsc

# --- OS Detection ---
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	OPEN_CMD = open
else ifeq ($(UNAME_S),Linux)
	OPEN_CMD = xdg-open
else
	OPEN_CMD = start
endif

# --- Directory Paths ---
DATA_DIR = data
PARSER_DIR = parser
CONFIG_DIR = config
VIS_DIR = visualization
D3_DIR = $(VIS_DIR)/d3
GOURCE_DIR = $(VIS_DIR)/other_eg_groute

# --- File Paths ---
PARSER_SCRIPT = $(PARSER_DIR)/parse.py
FORK_SCRIPT = $(PARSER_DIR)/fork_detector.py
CONFIG_JSON = $(CONFIG_DIR)/repo_config.json
JSON_OUTPUT = $(DATA_DIR)/streamgraph_data.json

TS_FILE = $(D3_DIR)/d3.ts
JS_OUTPUT = $(D3_DIR)/d3.js
HTML_FILE = $(D3_DIR)/index.html

PORT = 8000
HOST = http://localhost:$(PORT)
URL = $(HOST)/visualization/d3/index.html


# --- Targets ---

.PHONY: all poster data dates d3 gource clean help



all: poster

# 1. THE MAIN PIPELINE
poster: data d3 view 
	@echo "=================================================="
	@echo "🎨 POSTER ASSETS READY"
	@echo "=================================================="
	@echo "1. Data: $(JSON_OUTPUT)"
	@echo "2. D3: Opening browser..."
	@$(OPEN_CMD) $(HTML_FILE)
	@echo "3. Gource: Launching window..."

# 2. GENERATE CONFIG (Dates)
dates: $(CONFIG_JSON)

$(CONFIG_JSON): $(FORK_SCRIPT)
	@echo "⚙️  Creating config directory..."
	@mkdir -p $(CONFIG_DIR)
	@echo "🕵️  Detecting fork dates..."
	$(PYTHON) $(FORK_SCRIPT)

# 3. GENERATE DATA (Depends on Config)
data: $(JSON_OUTPUT)

$(JSON_OUTPUT): $(PARSER_SCRIPT) $(CONFIG_JSON)
	@echo "📊 Parsing Git history..."
	@mkdir -p $(DATA_DIR)
	$(PYTHON) $(PARSER_SCRIPT)

# 4. COMPILE D3
d3: $(JS_OUTPUT)

$(JS_OUTPUT): $(TS_FILE)
	@echo "🔨 Compiling D3 TypeScript..."
	$(TSC) $(TS_FILE) --target es6 --module es2015 --outDir $(D3_DIR)

view:
	@echo "🚀 Opening poster at $(URL)..."
	
	@# 1. Kill any existing server on this port (Idempotency Step)
	@echo "🔍 Checking for existing server on port $(PORT)..."
	@-lsof -ti :$(PORT) | xargs kill -9 2>/dev/null || true
	
	@# 2. Open the browser
	@if [ "$(UNAME_S)" = "Darwin" ]; then \
		open "$(URL)"; \
	elif [ "$(UNAME_S)" = "Linux" ]; then \
		xdg-open "$(URL)"; \
	else \
		start "$(URL)"; \
	fi
	
	@# 3. Start the server
	@echo "📡 Server starting on port $(PORT). Press Ctrl+C to stop."
	@python3 -m http.server $(PORT)
	
	sleep 0.5
# 5. GOURCE
gource:
	@echo "🕸️ Launching Gource..."
	gource --viewport 3840x2160 --transparent --hide-filenames --pause-at-end

# CLEANUP
clean:
	rm -f $(JSON_OUTPUT)
	rm -f $(JS_OUTPUT)
	rm -rf $(CONFIG_DIR)

help:
	@echo "Usage:"
	@echo "  make poster   - Run everything (dates -> data -> d3 -> gource)"
	@echo "  make dates    - Only regenerate the repo_config.json"
	@echo "  make data     - Only regenerate streamgraph_data.json"