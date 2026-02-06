// @ts-ignore
declare const d3: any;

// --- CONFIGURATION ---

// CANVAS: 3000px for Graph + 1200px for Sidebar = 4200px Total Width
const GRAPH_WIDTH = 3000;
const SIDEBAR_WIDTH = 1200;
const WIDTH = GRAPH_WIDTH + SIDEBAR_WIDTH;
const HEADER_HEIGHT = 600; 
const HEIGHT = 5400 + HEADER_HEIGHT;

const MARGIN = { top: HEADER_HEIGHT + 150, right: 100, bottom: 80, left: 350 };
const SIDEBAR_X_START = GRAPH_WIDTH + 150; 

// --- COLORS ---
const REPO_COLORS: { [key: string]: string } = {
    "production": "#E63946",       
    "production-frontend": "#e87233", 
    "shared": "#A8DADC",           
    "infrastructure": "#457B9D",   
    "profile-api": "#1D3557",
    "profile-db": "#FFB703",      
    "python-lib": "#1c9b8c",
    "segment-api": "#B56576",
    "advertiser-connect": "#264653"
};

const FALLBACK_COLORS = [
    "#6D597A", // Deep Purple
    "#F4A261", // Sandy Orange
    "#8AB17D", // Sage Green
    "#E76F51", // Burnt Sienna
    "#535154", // Charcoal Grey
    "#8172B3", // Soft Lavender
    "#948B3D", // Olive Green
    "#B5838D", // Old Rose
    "#937860", // Coffee Brown
    "#C44E52"  // Muted Red
]


const BG_COLOR = "#1a1a1a";
const TEXT_COLOR = "#ffffff";
const SUB_TEXT_COLOR = "#aaaaaa";
const ACCENT_COLOR = "#cccccc";
const SEPARATOR_COLOR = "#333333";

// --- GLOBAL HELPERS ---
const parseDate = d3.timeParse("%Y-%m");

// --- SIDEBAR DATA ---
const STATS = [
    { label: "Total Commits", value: "14,205" },
    { label: "Coffees", value: "≈ 8,500" },
    { label: "Lines Added", value: "1.2M+", color: "#daf6e6" }, 
    { label: "Lines Deleted", value: "850K", color: "#ffdcd8" }
];

const TRIVIA = [
    { question: "Most Productive Day", answer: "Tuesday" },
    { question: "Most Used Commit Msg", answer: "'fix typo'" },
    { question: "Most \"Productive\" Year", answer: "2020" },
    { question: "Cereal Bowls Consumed", answer: "≈ 2,400" },
    { question: "Mentored / Inspired", answer: "18 Devs" },
];

const TEAM_DATA = [
    { id: "AIS Team", value: 3500, color: "#00f2c3" },       
    { id: "AC (Ads)", value: 2800, color: "#00d2ff" },       
    { id: "Maintenance", value: 1500, color: "#bdc3c7" },    
    { id: "Unknown", value: 800, color: "#8e44ad" },         
    { id: "Refactor", value: 1200, color: "#ff4757" },       
    { id: "Experiments", value: 400, color: "#ffa502" },     
];

const QR_SVG_STRING = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="black">
  <rect x="0" y="0" width="100" height="100" fill="white"/>
  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z"/>
  <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z"/>
  <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z"/>
  <path d="M50,10 h5 v5 h-5 z M55,15 h5 v5 h-5 z M50,20 h5 v5 h-5 z M90,50 h5 v5 h-5 z"/>
  <path d="M45,45 h10 v10 h-10 z M55,55 h10 v10 h-10 z M65,45 h10 v10 h-10 z"/>
  <path d="M50,50 h40 v40 h-40 z" opacity="0.5"/>
  <rect x="55" y="55" width="5" height="5"/>
  <rect x="75" y="75" width="5" height="5"/>
  <rect x="60" y="80" width="5" height="5"/>
</svg>
`;
// --- MEETING DATA ---
// --- MANUAL MEETING DATA ---
// TODO: EDIT THESE NUMBERS
const RAW_MEETINGS_DATA = [
    { year: 2016, value: 500 },
    { year: 2017, value: 550 },
    { year: 2018, value: 690 },
    { year: 2019, value: 890 },
    { year: 2020, value: 1285 },
    { year: 2021, value: 1590 },
    { year: 2022, value: 1355 },
    { year: 2023, value: 1576 },
    { year: 2024, value: 1782 },
    { year: 2025, value: 1567 },
    { year: 2026, value: 96 }
];

// Convert plain numbers to Date objects for D3
const MEETINGS_DATA = RAW_MEETINGS_DATA.map(d => ({
    year: new Date(d.year, 0, 1),
    value: d.value
}));

const EVENTS = [
    { date: "2019-01", label: "Realtime System", color: "#fff" },
    { date: "2022-03", label: "Triplelift Acquisition", color: "#fff" },
    { date: "2025-01", label: "AIS Team", color: "#fff" }
];

// --- MAIN RENDER FUNCTION ---
async function drawPoster() {
    d3.select("#chart").html(""); 
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, WIDTH, HEIGHT])
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background", BG_COLOR)
        .style("font-family", "'Helvetica Neue', Helvetica, sans-serif");

    // --- IMPORT CUSTOM FONT (OSWALD) ---
    // A tall, condensed Sans that looks powerful in Small Caps
    svg.append("defs")
        .append("style")
        .attr("type", "text/css")
        .text("@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap');");

    const rawData = await d3.json("../../data/streamgraph_data.json");
    const data = rawData.map((d: any) => ({ ...d, dateObj: parseDate(d.date) }));

    drawHeader(svg);
    await drawStreamgraph(svg, data);
    drawSidebar(svg, data);
}

// --- COMPONENT: HEADER ---
function drawHeader(svg: any) {
    const g = svg.append("g").attr("class", "header");
    
    g.append("text")
        .attr("x", MARGIN.left) 
        .attr("y", 325)
        .text("A Decade of Impact") 
        // FONT CHANGE:
        .style("font-family", "'Futura', sans-serif") 
        .attr("font-size", "210px") 
        .attr("font-weight", "700") 
        .attr("fill", TEXT_COLOR)
        .style("font-variant", "small-caps") 
        .style("letter-spacing", "8px");
    
    g.append("text")
        .attr("x", MARGIN.left)
        .attr("y", 425)
        // Title Case here too
        .text("ANDREAS TSCHOFEN • COMMIT HISTORY FROM 2016 TO 2026") 
        .style("font-family", "'Futura', sans-serif") 
        .attr("font-size", "50px")
        .attr("font-weight", "bold")
        .attr("fill", SUB_TEXT_COLOR)
        .style("letter-spacing", "6px");

   // --- QR CODE (SVG EMBED) ---
    const qrSize = 280;
    const qrX = WIDTH - MARGIN.right - qrSize;
    const qrY = 50;

    // Create a group for the QR code
    const qrGroup = g.append("g")
        .attr("transform", `translate(${qrX}, ${qrY})`);

    // 1. Draw White Background Box (Vectors need contrast too)
    qrGroup.append("rect")
        .attr("width", qrSize)
        .attr("height", qrSize)
        .attr("fill", "white");

    // 2. Embed the SVG String
    // We append a group, inject the HTML (SVG string), and then scale it to fit
    const svgContent = qrGroup.append("g")
        .html(QR_SVG_STRING);
    
    // 3. Auto-Scale Logic
    // This assumes standard 100x100 viewBox in the placeholder. 
    // If you paste a custom SVG, just tweak the scale: (qrSize / YOUR_SVG_VIEWBOX_SIZE)
    svgContent.attr("transform", `scale(${qrSize / 10})`);


    g.append("line")
        .attr("x1", MARGIN.left)
        .attr("y1", 550)
        .attr("x2", WIDTH - 100) 
        .attr("y2", 550)
        .attr("stroke", SEPARATOR_COLOR)
        .attr("stroke-width", 4);
}

// --- COMPONENT: STREAMGRAPH ---
async function drawStreamgraph(svg: any, data: any[]) {
    const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "dateObj");
    const stack = d3.stack().keys(keys).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
    const series = stack(data);

    const y = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.dateObj))
        // Reduced bottom range slightly to keep graph tight
        .range([MARGIN.top, HEIGHT - MARGIN.bottom - 500]); 

    const maxStack = d3.max(series, (layer: any) => d3.max(layer, (d: any) => d[1]));
    const minStack = d3.min(series, (layer: any) => d3.min(layer, (d: any) => d[0]));
    const x = d3.scaleLinear()
        .domain([minStack, maxStack])
        .range([MARGIN.left, GRAPH_WIDTH - MARGIN.right]);

    const colorScale = (key: string) => {
        if (REPO_COLORS[key]) return REPO_COLORS[key];
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
        return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
    };

    const area = d3.area()
        .y((d: any) => y(d.data.dateObj))
        .x0((d: any) => x(d[0]))
        .x1((d: any) => x(d[1]))
        .curve(d3.curveBasis); 

    // Draw Event Lines
    const linesLayer = svg.append("g").attr("class", "event-lines");
    linesLayer.selectAll(".event-line")
        .data(EVENTS)
        .join("line")
        .attr("x1", MARGIN.left)
        .attr("x2", GRAPH_WIDTH - MARGIN.right)
        .attr("y1", (d: any) => y(parseDate(d.date)))
        .attr("y2", (d: any) => y(parseDate(d.date)))
        .attr("stroke", ACCENT_COLOR) 
        .attr("stroke-width", 2) 
        .attr("stroke-dasharray", "15,15")
        .attr("opacity", 0.4);

    // Draw Streams
    svg.append("g").selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (d: any) => colorScale(d.key))
        .attr("d", area)
        .attr("stroke", "rgba(0,0,0,0.2)")
        .attr("stroke-width", 1.5)
        .attr("opacity", 1);

    // Labels
    const labelsLayer = svg.append("g").attr("class", "labels");
    const labelData = series.map((d: any) => {
        let maxDiff = 0;
        let bestPoint = d[0];
        for (const point of d) {
            const diff = Math.abs(point[1] - point[0]);
            if (diff > maxDiff) { maxDiff = diff; bestPoint = point; }
        }
        return { key: d.key, x: x((bestPoint[0] + bestPoint[1]) / 2), y: y(bestPoint.data.dateObj), size: maxDiff };
    }).sort((a: any, b: any) => b.size - a.size);

    const placedLabels: any[] = [];
    const MIN_LABEL_DIST_Y = 60; 
    const MIN_LABEL_DIST_X = 100;

    const visibleLabels = labelData.filter((d: any) => {
        if (d.size < 0.5) return false;
        const collision = placedLabels.some((placed: any) => {
            return Math.abs(placed.y - d.y) < MIN_LABEL_DIST_Y && Math.abs(placed.x - d.x) < MIN_LABEL_DIST_X;
        });
        if (collision) return false;
        placedLabels.push(d);
        return true;
    });

    labelsLayer.selectAll("text.repo-label")
        .data(visibleLabels)
        .join("text")
        .attr("class", "repo-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "48px") 
        .style("font-weight", "bold") 
        .style("fill", "white")
        .style("pointer-events", "none")
        .style("text-shadow", "0px 2px 10px rgba(0,0,0,0.9)") 
        .text((d: any) => d.key)
        .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);

    // Event Labels
    labelsLayer.selectAll(".event-label")
        .data(EVENTS)
        .join("text")
        .attr("class", "event-label")
        .attr("x", GRAPH_WIDTH - MARGIN.right) 
        .attr("text-anchor", "end") 
        .attr("y", (d: any) => y(parseDate(d.date)))
        .attr("dy", "1.3em") 
        .text((d: any) => d.label)
        .attr("fill", ACCENT_COLOR)
        .attr("font-size", "50px") 
        .attr("font-weight", "bold")
        .style("letter-spacing", "1px")
        .style("text-shadow", "0px 2px 5px rgba(0,0,0,0.8)"); 

    // Y-Axis
    const yAxis = d3.axisLeft(y)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y"))
        .tickSize(0)
        .tickPadding(30);

    svg.append("g")
        .attr("transform", `translate(${MARGIN.left - 20}, 0)`)
        .call(yAxis)
        .call((g: any) => g.select(".domain").remove())
        .selectAll("text")
        .attr("font-size", "56px") 
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR);
}

// --- COMPONENT: SIDEBAR ---
function drawSidebar(svg: any, fullData: any[]) {
    const g = svg.append("g").attr("transform", `translate(${SIDEBAR_X_START}, ${MARGIN.top})`);

    // Separator Line
    g.append("line")
        .attr("x1", 0) .attr("y1", -50)
        .attr("x2", 0) .attr("y2", HEIGHT - MARGIN.top - MARGIN.bottom)
        .attr("stroke", SEPARATOR_COLOR)
        .attr("stroke-width", 2);

    let currentY = 50;
    
    // --- SECTION 1: KEY STATS ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("LIFETIME STATS")
        .attr("font-size", "54px") 
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");

    currentY += 100;

    STATS.forEach((stat: any, i) => {
        const xOffset = 80 + (i % 2) * 450; 
        const yOffset = currentY + Math.floor(i / 2) * 180;
        const valColor = stat.color ? stat.color : TEXT_COLOR;

        g.append("text")
            .attr("x", xOffset).attr("y", yOffset)
            .text(stat.value)
            .attr("font-size", "72px") 
            .attr("font-weight", "800")
            .attr("fill", valColor);
        
        g.append("text")
            .attr("x", xOffset).attr("y", yOffset + 55)
            .text(stat.label.toUpperCase())
            .attr("font-size", "30px") 
            .attr("fill", SUB_TEXT_COLOR)
            .style("letter-spacing", "1px");
    });

    // Reduced gap to fit more sections
    currentY += 450; 

    // --- SECTION 2: TRIVIA ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("TRIVIA")
        .attr("font-size", "54px")
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");
    
    currentY += 100;

    TRIVIA.forEach((item, i) => {
        g.append("text")
            .attr("x", 80).attr("y", currentY + (i * 140))
            .text(item.question)
            .attr("font-size", "40px") 
            .attr("fill", SUB_TEXT_COLOR);

        g.append("text")
            .attr("x", 80).attr("y", currentY + (i * 140) + 60)
            .text(item.answer)
            .attr("font-size", "48px") 
            .attr("font-weight", "bold")
            .attr("fill", TEXT_COLOR);
    });

    // Reduced gap
    currentY += (TRIVIA.length * 140) + 130;

    // --- SECTION 3: TEAM BUBBLES ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("COMMIT TYPES & TEAMS")
        .attr("font-size", "54px")
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");
    
    currentY += 80;

    const bubbleSize = 900; 
    const root = d3.hierarchy({ children: TEAM_DATA }).sum((d: any) => d.value);
    const pack = d3.pack().size([bubbleSize, bubbleSize]).padding(20);
    const rootNode = pack(root);

    const bubbles = g.append("g").attr("transform", `translate(80, ${currentY})`);
    const nodes = bubbles.selectAll(".node")
        .data(rootNode.leaves())
        .join("g")
        .attr("class", "node")
        .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);

    // Glass/HUD Style
    nodes.append("circle")
        .attr("r", (d: any) => d.r)
        .attr("fill", (d: any) => d.data.color)
        .attr("fill-opacity", 0.2) 
        .attr("stroke", (d: any) => d.data.color)
        .attr("stroke-width", 4); 

    nodes.append("text")
        .attr("dy", "-0.2em")
        .style("text-anchor", "middle")
        .text((d: any) => d.data.id)
        .attr("font-size", (d: any) => Math.min(2 * d.r / d.data.id.length * 1.5, 48) + "px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .style("pointer-events", "none")
        .style("text-shadow", "0px 2px 8px rgba(0,0,0,0.8)"); 

    nodes.append("text")
        .attr("dy", "1.2em")
        .style("text-anchor", "middle")
        .text((d: any) => d3.format(",")(d.data.value))
        .attr("font-size", (d: any) => Math.min(d.r / 3, 32) + "px")
        .attr("fill", "rgba(255,255,255,0.9)")
        .style("pointer-events", "none");

    currentY += bubbleSize + 200; // Move down

    // --- SECTION 4: MEETINGS GRAPH ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("MEETINGS ATTENDED")
        .attr("font-size", "54px")
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");
    
    currentY += 60;

    const graphHeight = 350;
    const graphWidth = 900;
    const graphG = g.append("g").attr("transform", `translate(80, ${currentY})`);

    const mX = d3.scaleTime()
        .domain(d3.extent(MEETINGS_DATA, (d: any) => d.year))
        .range([0, graphWidth]);
    
    const mY = d3.scaleLinear()
        .domain([0, d3.max(MEETINGS_DATA, (d: any) => d.value)])
        .range([graphHeight, 0]);

    const mArea = d3.area()
        .x((d: any) => mX(d.year))
        .y0(graphHeight)
        .y1((d: any) => mY(d.value))
        .curve(d3.curveStepAfter);

    graphG.append("path")
        .datum(MEETINGS_DATA)
        .attr("fill", "#e74c3c")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "#e74c3c")
        .attr("stroke-width", 3)
        .attr("d", mArea);

    graphG.append("line")
        .attr("x1", 0).attr("y1", graphHeight)
        .attr("x2", graphWidth).attr("y2", graphHeight)
        .attr("stroke", "#666").attr("stroke-width", 2);

    // --- NEW: START / END LABELS ---
    graphG.append("text")
        .attr("x", 0).attr("y", graphHeight + 40)
        .text("2016")
        .attr("font-size", "33px")
        .attr("font-weight", "bold")
        .attr("fill", "#666");

    graphG.append("text")
        .attr("x", graphWidth).attr("y", graphHeight + 40)
        .attr("text-anchor", "end") // Align right
        .text("2026")
        .attr("font-size", "33px")
        .attr("font-weight", "bold")
        .attr("fill", "#666");

    currentY += graphHeight + 250; // Final large gap for signature space

    // --- FINAL FOOTER ---
    g.append("text")
        .attr("x", SIDEBAR_WIDTH / 2 - 50) 
        .attr("y", currentY)
        .attr("text-anchor", "middle")
        .text("Thank you for everything!")
        .attr("font-size", "55")
        .attr("font-weight", "900")
        .attr("fill", TEXT_COLOR)
        .style("letter-spacing", "6px");
}

// --- BUTTON HELPER ---
setTimeout(() => {
    d3.select("#save-btn").on("click", () => {
        const svgNode = document.querySelector("#chart svg");
        saveSvg(svgNode, "tschofen_infographic_final.svg");
    });
}, 500);

function saveSvg(svgEl: any, name: string) {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// EXECUTE
drawPoster();