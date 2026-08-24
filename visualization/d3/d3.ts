// @ts-ignore
declare const d3: any;

// --- CONFIGURATION ---

// A1: 594 x 841 -> sqrt(2) ratio
// CANVAS: 5000 x 7000 keeps the sqrt(2) poster ratio
const WIDTH = 5000;
const HEIGHT = 7000;
const HEADER_HEIGHT = 900;

const EDGE = 100; // outer poster margin

// The right-hand column belongs entirely to the timeline now. The milestone
// type hangs in it, so the streams and the labels never share space.
const TIMELINE_WIDTH = 1200;

// Extra top margin leaves room for the beam + prism between header and graph;
// the bottom leaves room for the sign-off under the streams.
const MARGIN = { top: HEADER_HEIGHT + 700, right: TIMELINE_WIDTH, bottom: 650, left: 450 };

// Where the streams stop and the timeline gutter begins
const GRAPH_RIGHT = WIDTH - MARGIN.right;

// Milestone type is right-aligned into the gutter, with its band of the
// spectrum as a dot beyond it
const TIMELINE_LABEL_RIGHT = WIDTH - EDGE - 80;
const TIMELINE_DOT_X = WIDTH - EDGE - 20;

// The type hangs just under its own dashed line. Baseline and dot both come off
// the same gap, so the line, the label and the dot read as one row - and the
// label stays closer to its own milestone than to the one below it.
const TIMELINE_FONT_SIZE = 60;
const TIMELINE_CAP_HEIGHT = 0.70;  // Josefin Sans cap height, as a fraction of em
const TIMELINE_LABEL_GAP = 20;     // from the dashed line down to the cap tops
const TIMELINE_LABEL_DY = TIMELINE_LABEL_GAP + TIMELINE_FONT_SIZE * TIMELINE_CAP_HEIGHT;
// The dot sits on the optical centre of the caps, not on their baseline
const TIMELINE_DOT_DY = TIMELINE_LABEL_DY - (TIMELINE_FONT_SIZE * TIMELINE_CAP_HEIGHT) / 2;

const HEADER_RULE_Y = 750;

// The prism sits above the head of the streamgraph and disperses into it
const PRISM = {
    apexY: HEADER_HEIGHT + 90,
    height: 300,
    halfWidth: 175,
    beamOriginY: HEADER_HEIGHT + 40
};

// --- PALETTE: THE DARK SIDE OF THE CODEBASE ---
// The six bands of the Dark Side of the Moon prism (no indigo, as on the sleeve)
const SPECTRUM = [
    "#ee2b2b", // Red
    "#f58220", // Orange
    "#f7e425", // Yellow
    "#3cb44b", // Green
    "#1e6fd9", // Blue
    "#8b3fa8"  // Violet
];

// prism(t) samples the spectrum continuously, t in [0, 1]
const prism = d3.scaleLinear()
    .domain(SPECTRUM.map((_, i) => i / (SPECTRUM.length - 1)))
    .range(SPECTRUM)
    .interpolate(d3.interpolateHsl)
    .clamp(true);

const BG_COLOR = "#000000";
const TEXT_COLOR = "#ffffff";
const SUB_TEXT_COLOR = "#8c8c8c";
const ACCENT_COLOR = "#d8d8d8";
const SEPARATOR_COLOR = "#1e1e1e";

// --- TYPE: 1970s RECORD SLEEVE ---
// Monoton       the title only. Concentric inline strokes, pure 70s poster.
// Josefin Sans  deco geometric, stands in for the Futura of the sleeve but
//               with a smaller x-height, so it reads as display type.
// Space Grotesk the small stuff. Keeps the data legible next to two loud faces.
const TITLE_FONT = "'Monoton', 'Futura', 'Century Gothic', sans-serif";
const DISPLAY_FONT = "'Josefin Sans', 'Futura', 'Century Gothic', sans-serif";
const BODY_FONT = "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// --- GLOBAL HELPERS ---
const parseDate = d3.timeParse("%Y-%m");

function getDefs(svg: any) {
    let defs = svg.select("defs");
    if (defs.empty()) defs = svg.append("defs");
    return defs;
}

// Horizontal or vertical rainbow gradient, returns a paint reference
function spectrumGradient(svg: any, id: string, vertical = false, opacity = 1) {
    const grad = getDefs(svg).append("linearGradient")
        .attr("id", id)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", vertical ? "0%" : "100%")
        .attr("y2", vertical ? "100%" : "0%");

    SPECTRUM.forEach((c, i) => {
        grad.append("stop")
            .attr("offset", `${(i / (SPECTRUM.length - 1)) * 100}%`)
            .attr("stop-color", c)
            .attr("stop-opacity", opacity);
    });
    return `url(#${id})`;
}

// Chromatic split: a warm and a cool ghost sitting either side of the white
// type, the way light comes apart on the way through the glass. Three real text
// nodes rather than an SVG filter, so the export stays vector.
function chromaticText(g: any, text: string, x: number, y: number,
                       style: (sel: any) => void, spread = 14) {
    const ghosts = [
        { dx: -spread, dy: -spread * 0.6, color: SPECTRUM[0] },
        { dx: spread, dy: spread * 0.6, color: SPECTRUM[4] }
    ];

    ghosts.forEach(gh => {
        const ghost = g.append("text")
            .attr("x", x + gh.dx).attr("y", y + gh.dy)
            .text(text)
            .attr("fill", gh.color)
            .attr("opacity", 0.55);
        style(ghost);
    });

    const main = g.append("text")
        .attr("x", x).attr("y", y)
        .text(text)
        .attr("fill", TEXT_COLOR);
    style(main);
    return main;
}

// --- TIMELINE DATA ---
const RAW_EVENTS = [
    { date: "2017-01", label: "Ringier Axel Springer" },
    { date: "2017-05", label: "Audience Team" },
    { date: "2020-06", label: "Promotion! Data Consolidation Team Lead" },
    { date: "2021-02", label: "Series B - 10M raised" },
    { date: "2022-03", label: "Triplelift Acquisition" },
    { date: "2022-06", label: "Introduction to S. Kumar" },
    { date: "2022-09", label: "US Datacenter Launch" },
    { date: "2025-01", label: "Back to being a code monkey in the AIS Team" }
];

// Each milestone gets its own band of the spectrum, top to bottom
const EVENTS = RAW_EVENTS.map((d, i) => ({
    ...d,
    color: prism(i / (RAW_EVENTS.length - 1))
}));

// --- MAIN RENDER FUNCTION ---
async function drawPoster() {
    d3.select("#chart").html("");
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, WIDTH, HEIGHT])
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background", BG_COLOR) // Keep for web preview
        .style("font-family", BODY_FONT);


    // --- FIX: EXPLICIT BACKGROUND RECTANGLE ---
    // This ensures the background color is preserved in Illustrator/Exports
    svg.append("rect")
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .attr("fill", BG_COLOR);

    // Load Data AND QR Code SVG concurrently
    const [rawData, qrXml] = await Promise.all([
        d3.json("../../data/streamgraph_data.json"),
        d3.xml("../../resources/qr_silvano.svg").catch(() => null)
    ]);

    const data = rawData.map((d: any) => ({ ...d, dateObj: parseDate(d.date) }));

    drawHeader(svg, qrXml);
    await drawStreamgraph(svg, data);
    drawFooter(svg);
}

// --- COMPONENT: HEADER ---
function drawHeader(svg: any, qrXml: any) {
    const g = svg.append("g").attr("class", "header");

    // Title. Monoton runs much wider than Futura, so the point size comes down
    // and the inline strokes carry the weight instead.
    chromaticText(g, "Shine On You Crazy Diamond", MARGIN.left, 520, (t: any) => {
        t.style("font-family", TITLE_FONT)
            .attr("font-size", "190px")
            .attr("font-weight", "400")
            .style("letter-spacing", "6px");
    }, 16);

    // Subtitle
    g.append("text")
        .attr("x", MARGIN.left)
        .attr("y", 640)
        .text("SILVANO BRUGNONI • GITHUB COMMIT HISTORY FROM 2016 TO 2026")
        .style("font-family", DISPLAY_FONT)
        .attr("font-size", "70px")
        .attr("font-weight", "bold")
        .attr("fill", SUB_TEXT_COLOR)
        .style("letter-spacing", "6px");

    // --- QR CODE EMBEDDING ---
    if (qrXml) {
        const qrSize = 350;
        const qrX = WIDTH - EDGE - qrSize - 175;
        const qrY = 290;

        const qrGroup = g.append("g")
            .attr("transform", `translate(${qrX}, ${qrY})`);

        // 1. White Background Box (for contrast)
        qrGroup.append("rect")
            .attr("width", qrSize)
            .attr("height", qrSize)
            .attr("fill", "white");

        // 2. Import External SVG Node
        const importedNode = document.importNode(qrXml.documentElement, true);

        // 3. Scale & Pad the SVG to fit inside the box
        d3.select(importedNode)
            .attr("width", qrSize - 20)
            .attr("height", qrSize - 20)
            .attr("x", 10)
            .attr("y", 10);

        // Append the configured SVG to the group
        qrGroup.node().appendChild(importedNode);
    }

    // Separator: the spectrum itself, edge to edge
    const ruleX = MARGIN.left;
    const ruleW = (WIDTH - EDGE) - MARGIN.left - EDGE;

    g.append("rect")
        .attr("x", ruleX).attr("y", HEADER_RULE_Y)
        .attr("width", ruleW).attr("height", 8)
        .attr("fill", spectrumGradient(svg, "grad-header-rule"));
}

// --- COMPONENT: PRISM ---
// White light drops in from the left, hits the glass, and leaves as the
// streamgraph below. Pure geometry + gradients so it survives an SVG export.
function drawPrism(svg: any, cx: number, streamL: number, streamR: number) {
    const g = svg.append("g").attr("class", "prism");

    const apexY = PRISM.apexY;
    const baseY = apexY + PRISM.height;
    const half = PRISM.halfWidth;

    // 0. AFTERGLOW: the glass sitting in its own light
    const glow = getDefs(svg).append("radialGradient")
        .attr("id", "grad-prism-glow")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("cx", cx).attr("cy", baseY + 120).attr("r", 1000);
    [[0, SPECTRUM[4], 0.18], [0.45, SPECTRUM[5], 0.08], [1, SPECTRUM[5], 0]]
        .forEach(([offset, color, op]: any) => {
            glow.append("stop")
                .attr("offset", `${offset * 100}%`)
                .attr("stop-color", color)
                .attr("stop-opacity", op);
        });

    g.append("circle")
        .attr("cx", cx).attr("cy", baseY + 120).attr("r", 1000)
        .attr("fill", "url(#grad-prism-glow)");

    // 0b. INTERFERENCE RINGS: faint spectral ripples off the glass
    [200, 290, 380, 470].forEach((r, i) => {
        g.append("circle")
            .attr("cx", cx).attr("cy", baseY).attr("r", r)
            .attr("fill", "none")
            .attr("stroke", prism(i / 3))
            .attr("stroke-width", 4)
            .attr("stroke-opacity", 0.22 - i * 0.04);
    });

    // 1. DISPERSION FAN: prism base -> head of the streamgraph
    const fanTopL = cx - half + 12;
    const fanTopR = cx + half - 12;
    // Runs well past the head of the graph, so the tail that shows either
    // side of the streams fades out instead of ending on a hard edge
    const fanBottomY = MARGIN.top + 320;
    const headWidth = Math.max(streamR - streamL, 550);

    const bands = SPECTRUM.length;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Two passes: a wide, near-transparent ghost of the dispersion, then the
    // fan proper on top of it. The overspill reads as the light shimmering.
    const PASSES = [
        { id: "ghost", spread: 2.7, opacity: 0.16 },
        { id: "main", spread: 1.45, opacity: 1 }
    ];

    PASSES.forEach(pass => {
        // Wider than the stream head, so the bands bloom just past its edges
        const spanBottom = Math.max(headWidth * pass.spread, 800);
        const bottomL = cx - spanBottom / 2;
        const bottomR = cx + spanBottom / 2;

        SPECTRUM.forEach((color, i) => {
            // Fade out at the bottom so the seam with the streamgraph disappears
            const grad = getDefs(svg).append("linearGradient")
                .attr("id", `grad-fan-${pass.id}-${i}`)
                .attr("x1", "0%").attr("y1", "0%")
                .attr("x2", "0%").attr("y2", "100%");
            [[0, 0.95], [0.45, 0.82], [1, 0]].forEach(([offset, op]) => {
                grad.append("stop")
                    .attr("offset", `${offset * 100}%`)
                    .attr("stop-color", color)
                    .attr("stop-opacity", op);
            });

            // 1px overlap between bands avoids hairline gaps in print
            const t0 = i / bands, t1 = (i + 1) / bands;
            const path = [
                `M ${lerp(fanTopL, fanTopR, t0) - 1},${baseY}`,
                `L ${lerp(fanTopL, fanTopR, t1) + 1},${baseY}`,
                `L ${lerp(bottomL, bottomR, t1) + 1},${fanBottomY}`,
                `L ${lerp(bottomL, bottomR, t0) - 1},${fanBottomY}`,
                "Z"
            ].join(" ");

            g.append("path")
                .attr("d", path)
                .attr("fill", `url(#grad-fan-${pass.id}-${i})`)
                .attr("opacity", pass.opacity);
        });
    });

    // 2. THE GLASS
    const glass = getDefs(svg).append("linearGradient")
        .attr("id", "grad-glass")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    glass.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.07);
    glass.append("stop").attr("offset", "100%").attr("stop-color", "#000000").attr("stop-opacity", 1);

    g.append("path")
        .attr("d", `M ${cx},${apexY} L ${cx + half},${baseY} L ${cx - half},${baseY} Z`)
        .attr("fill", "url(#grad-glass)")
        .attr("stroke", TEXT_COLOR)
        .attr("stroke-width", 5)
        .attr("stroke-linejoin", "round");

    // 3. THE BEAM: in from the left edge, onto the left face of the prism
    const hitX = cx - half * 0.5;
    const hitY = apexY + PRISM.height * 0.5;

    const beam = getDefs(svg).append("linearGradient")
        .attr("id", "grad-beam")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0).attr("y1", PRISM.beamOriginY)
        .attr("x2", hitX).attr("y2", hitY);
    beam.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.15);
    beam.append("stop").attr("offset", "70%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.75);
    beam.append("stop").attr("offset", "100%").attr("stop-color", "#ffffff").attr("stop-opacity", 1);

    // Soft halo, then the hard edge of the beam
    [{ w: 44, o: 0.10 }, { w: 10, o: 1 }].forEach(s => {
        g.append("line")
            .attr("x1", 0).attr("y1", PRISM.beamOriginY)
            .attr("x2", hitX).attr("y2", hitY)
            .attr("stroke", "url(#grad-beam)")
            .attr("stroke-width", s.w)
            .attr("opacity", s.o)
            .attr("stroke-linecap", "round");
    });

    // Flare where the beam enters the glass
    const flare = getDefs(svg).append("radialGradient").attr("id", "grad-flare");
    flare.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.45);
    flare.append("stop").attr("offset", "100%").attr("stop-color", "#ffffff").attr("stop-opacity", 0);

    g.append("circle")
        .attr("cx", hitX).attr("cy", hitY).attr("r", 110)
        .attr("fill", "url(#grad-flare)");
}

// --- COMPONENT: STREAMGRAPH ---
async function drawStreamgraph(svg: any, data: any[]) {
    const keys = Object.keys(data[0]).filter(k => k !== "date" && k !== "dateObj");
    const stack = d3.stack().keys(keys).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
    const series = stack(data);

    // The wiggle offset lets the whole ribbon meander sideways over the decade,
    // so the x domain has to be wide enough to hold the meander rather than the
    // streams: only ~73% of the plot ever carries colour. Pulling each month
    // back towards the centre reclaims that. Every layer in a month moves by the
    // same amount, so the band widths - the actual data - are untouched; only
    // the horizontal wander is damped. 0 = raw wiggle, 1 = fully centred.
    const DRIFT_CORRECTION = 0.75;

    for (let row = 0; row < data.length; row++) {
        let lo = Infinity, hi = -Infinity;
        for (const layer of series) {
            lo = Math.min(lo, layer[row][0]);
            hi = Math.max(hi, layer[row][1]);
        }
        const shift = ((lo + hi) / 2) * DRIFT_CORRECTION;
        for (const layer of series) {
            layer[row][0] -= shift;
            layer[row][1] -= shift;
        }
    }

    const y = d3.scaleTime()
        .domain(d3.extent(data, (d: any) => d.dateObj))
        .range([MARGIN.top, HEIGHT - MARGIN.bottom]);

    const maxStack = d3.max(series, (layer: any) => d3.max(layer, (d: any) => d[1]));
    const minStack = d3.min(series, (layer: any) => d3.min(layer, (d: any) => d[0]));
    const x = d3.scaleLinear()
        .domain([minStack, maxStack])
        .range([MARGIN.left, GRAPH_RIGHT]);

    // Colour by position in the stack, not by name: the graph reads left to
    // right as dispersed light instead of as an unrelated set of hues.
    const lastIndex = Math.max(series.length - 1, 1);
    const colorScale = (layer: any) => prism(layer.index / lastIndex);

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
        .attr("x1", MARGIN.left + 150)
        .attr("x2", TIMELINE_LABEL_RIGHT)
        .attr("y1", (d: any) => y(parseDate(d.date)))
        .attr("y2", (d: any) => y(parseDate(d.date)))
        .attr("stroke", ACCENT_COLOR)
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "6,26")
        .attr("opacity", 0.45);

    // Prism on top of the milestone dashes, but under the streams: the fan
    // runs beneath the head of the graph so the seam is hidden
    const firstMin = d3.min(series, (s: any) => s[0][0]);
    const firstMax = d3.max(series, (s: any) => s[0][1]);
    drawPrism(svg, (x(firstMin) + x(firstMax)) / 2, x(firstMin), x(firstMax));

    // Draw Streams
    svg.append("g").selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (d: any) => colorScale(d))
        .attr("d", area)
        // Crisp black edges keep the bands separate, like the sleeve
        .attr("stroke", "#000000")
        .attr("stroke-width", 3)
        .attr("stroke-opacity", 0.55)
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


    labelsLayer.selectAll("text.halo-label")
        .data(visibleLabels)
        .join("text")
        .attr("class", "halo-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", BODY_FONT)
        .style("font-size", "60px")
        .style("font-weight", "bold")
        .style("stroke", "#000000") // Black Halo
        .style("stroke-width", "14px") // Thick Outline
        .style("stroke-linejoin", "round") // Smooth corners
        .style("stroke-opacity", "0.45") // Readable on the bright bands, still vector
        .style("fill", "none") // No fill, just outline
        .style("pointer-events", "none")
        .text((d: any) => d.key)
        .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);


    labelsLayer.selectAll("text.repo-label")
        .data(visibleLabels)
        .join("text")
        .attr("class", "repo-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "60px")
        .style("font-weight", "bold")
        .style("fill", "white")
        .style("pointer-events", "none")
        .text((d: any) => d.key)
        .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);

    // Event Labels
    labelsLayer.selectAll(".event-label")
        .data(EVENTS)
        .join("text")
        .attr("class", "event-label")
        .attr("x", TIMELINE_LABEL_RIGHT)
        .attr("text-anchor", "end")
        .attr("y", (d: any) => y(parseDate(d.date)) + TIMELINE_LABEL_DY)
        .text((d: any) => d.label.toUpperCase())
        .style("font-family", DISPLAY_FONT)
        .attr("fill", TEXT_COLOR)
        .attr("font-size", `${TIMELINE_FONT_SIZE}px`)
        .attr("font-weight", "700")
        .style("letter-spacing", "4px");

    // A single band of the spectrum marks each milestone
    labelsLayer.selectAll(".event-dot")
        .data(EVENTS)
        .join("circle")
        .attr("class", "event-dot")
        .attr("cx", TIMELINE_DOT_X)
        .attr("cy", (d: any) => y(parseDate(d.date)) + TIMELINE_DOT_DY)
        .attr("r", 16)
        .attr("fill", (d: any) => d.color);

    // Y-Axis
    const yAxis = d3.axisLeft(y)
        .ticks(d3.timeYear.every(1))
        .tickFormat(d3.timeFormat("%Y"))
        .tickSize(0)
        .tickPadding(30);

    svg.append("g")
        .attr("transform", `translate(${MARGIN.left + 75}, 0)`)
        .call(yAxis)
        .call((g: any) => g.select(".domain").remove())
        .selectAll("text")
        .style("font-family", DISPLAY_FONT)
        .attr("font-size", "60px")
        .attr("font-weight", "bold")
        .attr("letter-spacing", "3px")
        .attr("fill", SUB_TEXT_COLOR);
}

// --- COMPONENT: FOOTER ---
// The sign-off, running the full width of the sheet now that the stats column
// is gone: the message, then the heartbeat off the sleeve's back cover.
function drawFooter(svg: any) {
    const g = svg.append("g").attr("class", "footer");

    const left = MARGIN.left;
    const right = WIDTH - EDGE;

    chromaticText(g, "Thank you for everything!", (left + right) / 2, HEIGHT - 340, (t: any) => {
        t.attr("text-anchor", "middle")
            .style("font-family", DISPLAY_FONT)
            .attr("font-size", "90px")
            .attr("font-weight", "700")
            .style("letter-spacing", "5px");
    }, 10);

    drawPulse(svg, g, left, HEIGHT - 150, right - left);
}

// --- COMPONENT: PULSE ---
function drawPulse(svg: any, g: any, x: number, y: number, w: number) {
    // Flat line, one beat, flat line again
    const beats = [
        [0, 0], [0.34, 0], [0.38, -0.12], [0.44, 0.10],
        [0.48, -1], [0.52, 0.55], [0.57, -0.10], [0.62, 0],
        [1, 0]
    ];
    const amp = 90;
    const path = beats
        .map(([t, v], i) => `${i === 0 ? "M" : "L"} ${x + t * w},${y + v * amp}`)
        .join(" ");

    // Spectral bloom underneath, then the white trace
    g.append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", spectrumGradient(svg, "grad-pulse"))
        .attr("stroke-width", 26)
        .attr("stroke-opacity", 0.35)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round");

    g.append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", TEXT_COLOR)
        .attr("stroke-width", 6)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round");
}

// --- BUTTON HELPER ---
setTimeout(() => {
    d3.select("#save-btn").on("click", () => {
        const svgNode = document.querySelector("#chart svg");
        saveSvg(svgNode, "brugnoni_infographic_final.svg");
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
