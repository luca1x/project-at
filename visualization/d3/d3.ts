// @ts-ignore
declare const d3: any;

// --- CONFIGURATION ---

// CANVAS: 3000px for Graph + 1200px for Sidebar = 4200px Total Width
// (Slightly reduced sidebar width to balance the new font sizes)
const GRAPH_WIDTH = 3000;
const SIDEBAR_WIDTH = 1200;
const WIDTH = GRAPH_WIDTH + SIDEBAR_WIDTH;
const HEIGHT = 4000;

const MARGIN = { top: 150, right: 100, bottom: 80, left: 350 };
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
    "#6D597A", // Deep Purple (Missing from your main list, great contrast)
    "#F4A261", // Sandy Orange (Softer than your frontend orange)
    "#8AB17D", // Sage Green ( Distinct from your Teal)
    "#E76F51", // Burnt Sienna (Earthy red-orange)
    "#535154", // Charcoal Grey (Good for "boring" utility repos)
    "#8172B3", // Soft Lavender
    "#948B3D", // Olive Green
    "#B5838D", // Old Rose (Lighter/Softer than segment-api)
    "#937860", // Coffee Brown
    "#C44E52"  // Muted Red
]

const BG_COLOR = "#1a1a1a";
const TEXT_COLOR = "#ffffff";
const SUB_TEXT_COLOR = "#aaaaaa";
const ACCENT_COLOR = "#cccccc";

// --- DUMMY DATA FOR SIDEBAR (To be filled later) ---
const STATS = [
    { label: "Total Commits", value: "14,205" },
    { label: "Lines Added", value: "1.2M+" },
    { label: "Active Days", value: "3,402" },
    { label: "Coffees", value: "≈ 8,500" }
];

const TRIVIA = [
    { question: "Most Productive Day", answer: "Tuesday" },
    { question: "Least Productive Year", answer: "2018" },
    { question: "Most Used Commit Msg", answer: "'fix typo'" },
    { question: "Longest Streak", answer: "42 Days" },
];

const FEATURED_REPOS = ["production", "profile-api", "python-lib"];

// --- EVENTS ---
const EVENTS = [
    { date: "2016-01", label: "First Commit", color: "#fff" }, 
    { date: "2019-01", label: "Realtime System", color: "#fff" },
    { date: "2021-02", label: "Acquisition by Triplelift", color: "#fff" },
    { date: "2025-01", label: "AIS Team", color: "#fff" }
];

const parseDate = d3.timeParse("%Y-%m");

// --- MAIN RENDER FUNCTION ---
async function drawPoster() {
    d3.select("#chart").html(""); 
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, WIDTH, HEIGHT])
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background", BG_COLOR)
        .style("font-family", "'Helvetica Neue', Helvetica, sans-serif");

    const rawData = await d3.json("../../data/streamgraph_data.json");
    const data = rawData.map((d: any) => ({ ...d, dateObj: parseDate(d.date) }));

    await drawStreamgraph(svg, data);
    drawSidebar(svg, data);
}

// --- COMPONENT: STREAMGRAPH ---
async function drawStreamgraph(svg: any, data: any[]) {
    const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "dateObj");
    const stack = d3.stack().keys(keys).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
    const series = stack(data);

    // Scales
    const y = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.dateObj))
        .range([MARGIN.top, HEIGHT - MARGIN.bottom]);

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
        .attr("stroke-width", 2) // Thinner lines
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

    // Labels with Collision Logic
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
    // Tighter constraints for smaller fonts
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
        .style("font-size", "42px") // <--- REDUCED from 70px
        .style("font-weight", "bold") // "Bold" instead of "900" is cleaner
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
        .attr("dy", "1.3em") // Tighter spacing
        .text((d: any) => d.label)
        .attr("fill", ACCENT_COLOR)
        .attr("font-size", "32px") // <--- REDUCED from 48px
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
        .attr("font-size", "48px") // <--- REDUCED from 64px
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR);
}

// --- COMPONENT: SIDEBAR ---
function drawSidebar(svg: any, fullData: any[]) {
    const g = svg.append("g").attr("transform", `translate(${SIDEBAR_X_START}, ${MARGIN.top})`);

    // Separator Line
    g.append("line")
        .attr("x1", 0) .attr("y1", 0)
        .attr("x2", 0) .attr("y2", HEIGHT - MARGIN.top - MARGIN.bottom)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    let currentY = 50;
    const SECTION_GAP = 100;

    // --- SECTION 1: KEY STATS ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("LIFETIME STATS")
        .attr("font-size", "36px") // <--- REDUCED HEADER
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");

    currentY += 100;

    STATS.forEach((stat, i) => {
        const xOffset = 80 + (i % 2) * 450; 
        const yOffset = currentY + Math.floor(i / 2) * 180;
        
        g.append("text")
            .attr("x", xOffset).attr("y", yOffset)
            .text(stat.value)
            .attr("font-size", "72px") // <--- REDUCED VALUE
            .attr("font-weight", "800")
            .attr("fill", TEXT_COLOR);
        
        g.append("text")
            .attr("x", xOffset).attr("y", yOffset + 45)
            .text(stat.label.toUpperCase())
            .attr("font-size", "24px") // <--- REDUCED LABEL
            .attr("fill", SUB_TEXT_COLOR)
            .style("letter-spacing", "1px");
    });

    currentY += 450;

    // --- SECTION 2: TRIVIA ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("TRIVIA")
        .attr("font-size", "36px")
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");
    
    currentY += 100;

    TRIVIA.forEach((item, i) => {
        g.append("text")
            .attr("x", 80).attr("y", currentY + (i * 140))
            .text(item.question)
            .attr("font-size", "28px") // <--- REDUCED QUESTION
            .attr("fill", SUB_TEXT_COLOR);

        g.append("text")
            .attr("x", 80).attr("y", currentY + (i * 140) + 40)
            .text(item.answer)
            .attr("font-size", "42px") // <--- REDUCED ANSWER
            .attr("font-weight", "bold")
            .attr("fill", TEXT_COLOR);
    });

    currentY += 650;

    // --- SECTION 3: TOP REPOS ---
    g.append("text")
        .attr("x", 80).attr("y", currentY)
        .text("KEY REPO GROWTH")
        .attr("font-size", "36px")
        .attr("font-weight", "bold")
        .attr("fill", ACCENT_COLOR)
        .style("letter-spacing", "3px");
    
    currentY += 120;

    const getColor = (key: string) => REPO_COLORS[key] || "#999";

    FEATURED_REPOS.forEach((repoKey, i) => {
        const plotHeight = 220; // Slightly smaller plots
        const plotWidth = 800;
        const yPos = currentY + (i * (plotHeight + 100));

        g.append("text")
            .attr("x", 80).attr("y", yPos - 20)
            .text(repoKey)
            .attr("font-size", "36px") // <--- REDUCED TITLE
            .attr("font-weight", "bold")
            .attr("fill", getColor(repoKey));

        // Background
        g.append("rect")
            .attr("x", 80).attr("y", yPos)
            .attr("width", plotWidth).attr("height", plotHeight)
            .attr("fill", "#222").attr("rx", 15);

        // Plot
        const repoData = fullData.map((d: any) => ({ date: d.dateObj, value: d[repoKey] || 0 }));
        const miniX = d3.scaleTime()
            .domain(d3.extent(repoData, (d: any) => d.date))
            .range([80, 80 + plotWidth]);
        const miniY = d3.scaleLinear()
            .domain([0, d3.max(repoData, (d: any) => d.value)])
            .range([yPos + plotHeight, yPos + 15]);

        const miniArea = d3.area()
            .x((d: any) => miniX(d.date))
            .y0(yPos + plotHeight)
            .y1((d: any) => miniY(d.value))
            .curve(d3.curveMonotoneX);

        g.append("path")
            .datum(repoData)
            .attr("fill", getColor(repoKey)).attr("fill-opacity", 0.6)
            .attr("stroke", getColor(repoKey)).attr("stroke-width", 3)
            .attr("d", miniArea);
    });
}

// --- BUTTON HELPER ---
setTimeout(() => {
    d3.select("#save-btn").on("click", () => {
        const svgNode = document.querySelector("#chart svg");
        saveSvg(svgNode, "tschofen_infographic.svg");
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