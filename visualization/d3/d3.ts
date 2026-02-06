// @ts-ignore
declare const d3: any;

// --- CONFIGURATION ---

// POSTER DIMENSIONS (Vertical Portrait Mode)
const WIDTH = 2000;
const HEIGHT = 3000;
const MARGIN = { top: 100, right: 200, bottom: 50, left: 250 };

// --- COLOR CONFIGURATION ---
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
    // Add others here...
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
];

// --- TIMELINE EVENTS ---
// Add your major milestones here
const EVENTS = [
    { date: "2021-02", label: "Acquisition", color: "#fff" },
    { date: "2016-01", label: "Founded / First Commit", color: "#FFD700" }, // Example
    // { date: "2019-06", label: "Major Refactor", color: "#ccc" },
];

async function drawChart() {
    // 1. Load Data
    const rawData = await d3.json("../../data/streamgraph_data.json");

    // 2. Parse Dates
    const parseDate = d3.timeParse("%Y-%m");
    const data = rawData.map((d: any) => {
        return { ...d, dateObj: parseDate(d.date) };
    });

    // 3. Stack Setup
    const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "dateObj");
    const stack = d3.stack()
        .keys(keys)
        .offset(d3.stackOffsetWiggle)
        .order(d3.stackOrderInsideOut);
    const series = stack(data);

    // 4. Scales
    const y = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.dateObj))
        .range([MARGIN.top, HEIGHT - MARGIN.bottom]);

    const maxStack = d3.max(series, (layer: any) => d3.max(layer, (d: any) => d[1]));
    const minStack = d3.min(series, (layer: any) => d3.min(layer, (d: any) => d[0]));
    
    const x = d3.scaleLinear()
        .domain([minStack, maxStack])
        .range([MARGIN.left, WIDTH - MARGIN.right]);

    const colorScale = (key: string) => {
        if (REPO_COLORS[key]) return REPO_COLORS[key];
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
        const index = Math.abs(hash) % FALLBACK_COLORS.length;
        return FALLBACK_COLORS[index];
    };

    const area = d3.area()
        .y((d: any) => y(d.data.dateObj))
        .x0((d: any) => x(d[0]))
        .x1((d: any) => x(d[1]))
        .curve(d3.curveBasis); 

    // 6. Draw SVG
    d3.select("#chart").html(""); 

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, WIDTH, HEIGHT])
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background", "#1a1a1a")
        .style("font-family", "'Helvetica Neue', Helvetica, sans-serif");

    const AXIS_COLOR = "#cccccc";

    // --- LAYER 1: EVENT LINES (Background) ---
    // Drawn first so they sit BEHIND the graph
    const linesLayer = svg.append("g").attr("class", "event-lines");

    linesLayer.selectAll(".event-line")
        .data(EVENTS)
        .join("line")
        .attr("x1", MARGIN.left)
        .attr("x2", WIDTH - MARGIN.right)
        .attr("y1", (d: any) => y(parseDate(d.date)))
        .attr("y2", (d: any) => y(parseDate(d.date)))
        .attr("stroke", AXIS_COLOR) 
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "15,15")
        .attr("opacity", 0.5);

    // --- LAYER 2: STREAMGRAPH (Middle) ---
    const streamLayer = svg.append("g").attr("class", "streams");
    
    streamLayer.selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (d: any) => colorScale(d.key))
        .attr("d", area)
        .attr("stroke", "rgba(0,0,0,0.2)")
        .attr("stroke-width", 1)
        .attr("opacity", 1);

    // --- LAYER 3: LABELS (Foreground) ---
    // Includes both Repo Labels and Event Labels so they sit ON TOP
    const labelsLayer = svg.append("g").attr("class", "labels");

    // 3a. Repo Labels
    labelsLayer.selectAll("text.repo-label")
        .data(series)
        .join("text")
        .attr("class", "repo-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "32px") 
        .style("font-weight", "900") 
        .style("fill", "white")
        .style("pointer-events", "none")
        .style("text-shadow", "0px 4px 15px rgba(0,0,0,1)") 
        .text((d: any) => d.key)
        .attr("transform", (d: any) => {
            let maxDiff = 0;
            let bestPoint = d[0];
            for (const point of d) {
                const diff = Math.abs(point[1] - point[0]);
                if (diff > maxDiff) { maxDiff = diff; bestPoint = point; }
            }
            if (maxDiff < 0.5) return "translate(-9999, -9999)";
            const yPos = y(bestPoint.data.dateObj);
            const xPos = x((bestPoint[0] + bestPoint[1]) / 2);
            return `translate(${xPos}, ${yPos})`;
        });

    // 3b. Event Labels (FIXED POSITION)
    labelsLayer.selectAll(".event-label")
        .data(EVENTS)
        .join("text")
        .attr("class", "event-label")
        // Align to the END of the line (Right side)
        .attr("x", WIDTH - MARGIN.right) 
        // Anchor End: Text grows to the left, preventing "peeking out"
        .attr("text-anchor", "end") 
        .attr("y", (d: any) => y(parseDate(d.date)))
        // Push DOWN below the line
        .attr("dy", "1.2em") 
        .text((d: any) => d.label)
        .attr("fill", AXIS_COLOR)
        .attr("font-size", "24px")
        .attr("font-weight", "bold")
        .style("letter-spacing", "1px")
        // Add shadow just in case it overlaps a bright part of the graph
        .style("text-shadow", "0px 2px 5px rgba(0,0,0,0.8)"); 

    // 9. Y-Axis
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
        .attr("font-size", "32px")
        .attr("font-weight", "bold")
        .attr("fill", AXIS_COLOR);
}
// --- BUTTON LOGIC ---
drawChart();

setTimeout(() => {
    d3.select("#save-btn").on("click", () => {
        const svgNode = document.querySelector("#chart svg");
        saveSvg(svgNode, "tschofen_code_poster_final.svg");
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