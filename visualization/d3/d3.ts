// @ts-ignore
declare const d3: any;

// --- CONFIGURATION ---
// Poster size (A2/A1 ratio approx, or huge for high-res print)
const WIDTH = 1200;
const HEIGHT = 800;
const MARGIN = { top: 40, right: 150, bottom: 60, left: 50 };

// A rich, distinct palette for many repositories
const COLORS = [
    "#396AB1", "#DA7C30", "#3E9651", "#CC2529", "#535154", 
    "#6B4C9A", "#922428", "#948B3D", "#1C1C1C", "#4C72B0",
    "#DD8452", "#55A868", "#C44E52", "#8172B3", "#937860"
];

async function drawChart() {
    // 1. Load Data
    // Note: This path is relative to the HTML file in the browser
    const rawData = await d3.json("../../data/streamgraph_data.json");

    // 2. Parse Dates
    // The JSON date is "YYYY-MM", we need a Date object
    const parseDate = d3.timeParse("%Y-%m");
    const data = rawData.map((d: any) => {
        const parsed = { ...d, dateObj: parseDate(d.date) };
        return parsed;
    });

    // 3. Extract Keys (Repo Names)
    // We filter out 'date' and 'dateObj' to get just the repo names
    const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "dateObj");

    // 4. Create the Stack
    // "wiggle" minimizes the wiggle of the layers (best for streamgraphs)
    // "inside-out" sorts layers by size (largest in middle) for balance
    const stack = d3.stack()
        .keys(keys)
        .offset(d3.stackOffsetWiggle) 
        .order(d3.stackOrderInsideOut);

    const series = stack(data);

    // 5. Scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.dateObj))
        .range([MARGIN.left, WIDTH - MARGIN.right]);

    const y = d3.scaleLinear()
        .domain([
            d3.min(series, (layer: any) => d3.min(layer, (d: any) => d[0])),
            d3.max(series, (layer: any) => d3.max(layer, (d: any) => d[1]))
        ])
        .range([HEIGHT - MARGIN.bottom, MARGIN.top]);

    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(COLORS);

    // 6. Area Generator
    // curveBasis gives that smooth, liquid flow
    const area = d3.area()
        .x((d: any) => x(d.data.dateObj))
        .y0((d: any) => y(d[0]))
        .y1((d: any) => y(d[1]))
        .curve(d3.curveBasis);

    // 7. Select and Clear SVG
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, WIDTH, HEIGHT])
        .style("font-family", "Helvetica, sans-serif");

    // 8. Draw the Streams
    const paths = svg.selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (d: any) => color(d.key))
        .attr("d", area)
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.9);

    // 9. Add Tooltips (Simple browser title for inspection)
    paths.append("title")
        .text((d: any) => d.key);

    // 10. Add Labels (The tricky part)
    // We try to place labels at the "widest" part of each stream
    svg.selectAll(".label")
        .data(series)
        .join("text")
        .attr("font-family", "Helvetica, sans-serif")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .style("text-shadow", "0px 0px 2px rgba(0,0,0,0.5)") // Illustrator might ignore shadows, but browsers love them
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "white")
        .style("pointer-events", "none")
        .text((d: any) => d.key)
        .attr("transform", (d: any) => {
            // Find the data point with the biggest height (y0 - y1)
            let maxDiff = 0;
            let bestPoint = d[0];
            
            for (const point of d) {
                const diff = Math.abs(point[1] - point[0]);
                if (diff > maxDiff) {
                    maxDiff = diff;
                    bestPoint = point;
                }
            }
            
            // If the stream is too thin, don't label it (or label it nearby)
            if (maxDiff < 5) return "translate(-9999, -9999)";

            const xPos = x(bestPoint.data.dateObj);
            const yPos = y((bestPoint[0] + bestPoint[1]) / 2);
            return `translate(${xPos}, ${yPos})`;
        });

    // 11. X-Axis (Years)
    const xAxis = d3.axisBottom(x)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y"))
        .tickSize(0)
        .tickPadding(10);

    svg.append("g")
        .attr("transform", `translate(0, ${HEIGHT - MARGIN.bottom})`)
        .call(xAxis)
        .call((g: any) => g.select(".domain").remove()) // Hide the axis line
        .selectAll("text")
        .attr("font-size", "14px")
        .attr("fill", "#666");
}

function saveSvg(svgEl: any, name: string) {
    // 1. Serialize the SVG DOM to a string
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);

    // 2. Add XML namespaces if they are missing (browsers sometimes strip them)
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // 3. Prep the URL
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

    // 4. Create a fake link and click it
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Hook up the button (add this after your drawChart() call)
d3.select("#save-btn").on("click", () => {
    const svgNode = document.querySelector("#chart svg");
    saveSvg(svgNode, "streamgraph.svg");
});

drawChart();