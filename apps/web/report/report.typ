#let d = json(sys.inputs.at("data"))
#let mono = "DejaVu Sans Mono"
#let rule = line(length: 100%, stroke: 0.4pt)

#set document(title: d.title, author: "Cakra Nala")
#set text(font: "Libertinus Serif", size: 10.5pt, lang: "en")
#set par(justify: true, leading: 0.62em, spacing: 0.9em)
#set page(
  paper: "a4",
  margin: (top: 28mm, bottom: 24mm, x: 22mm),
  header: context {
    set text(7.5pt, font: mono, tracking: 1.2pt)
    align(center, d.classification)
    v(-5pt)
    rule
  },
  footer: context {
    set text(7pt, font: mono)
    rule
    v(-5pt)
    grid(
      columns: (1fr, auto, 1fr),
      [REPORT #d.short],
      text(tracking: 1.2pt, d.classification),
      align(right)[PAGE #counter(page).display() OF #counter(page).final().first()],
    )
  },
)

#let n = counter("section")
#let section(title) = {
  n.step()
  v(12pt)
  block(sticky: true, text(9pt, weight: "bold", tracking: 1pt)[#context n.display(). #h(4pt) #upper(title)])
  v(1pt)
}
#let meta(k, v) = (text(7.5pt, font: mono, upper(k)), text(9.5pt, v))

#grid(
  columns: (1fr, auto),
  align: (left + bottom, right + bottom),
  [
    #text(13pt, weight: "bold", tracking: 3pt)[CAKRA NALA] \
    #text(7.5pt, font: mono, tracking: 1pt)[COGNITIVE THREAT INTELLIGENCE]
  ],
  text(7.5pt, font: mono)[DTG #d.dtg],
)
#v(-2pt)
#line(length: 100%, stroke: 1.4pt)
#v(10pt)
#text(7.5pt, font: mono, tracking: 1pt)[INTELLIGENCE REPORT]
#v(-6pt)
#text(18pt, weight: "bold", hyphenate: false)[#d.title]
#v(4pt)
#table(
  columns: (auto, 1fr, auto, 1fr),
  stroke: (x, y) => (top: if y == 0 { 0.4pt }, bottom: 0.4pt),
  inset: (x: 0pt, y: 5pt),
  column-gutter: 10pt,
  ..meta("Threat level", upper(d.threatLevel)),
  ..meta("Confidence", d.confidence),
  ..meta("Report", d.short),
  ..meta("Case", d.caseShort),
  ..meta("Issued", d.issued),
  ..meta("Prepared by", d.preparedBy),
)

#section("Bottom line up front")
#text(11.5pt, d.bluf)

#if d.assessment != "" {
  section("Assessment")
  d.assessment
}

#section("Key facts")
#table(
  columns: (1fr, auto),
  stroke: (x, y) => (bottom: 0.3pt + luma(160)),
  inset: (x: 0pt, y: 5pt),
  ..d.facts.map(f => (f.label, align(right, strong(f.value)))).flatten(),
)

#if d.findings.len() > 0 {
  section("Findings")
  enum(numbering: "a.", indent: 4pt, ..d.findings)
}

#if d.actions.len() > 0 {
  section("Recommended actions")
  enum(numbering: "a.", indent: 4pt, ..d.actions)
}

#if d.disarm.len() > 0 {
  section("Techniques observed")
  table(
    columns: (auto, 1fr),
    stroke: (x, y) => (bottom: 0.3pt + luma(160)),
    inset: (x: 0pt, y: 5pt),
    column-gutter: 12pt,
    ..d.disarm.map(t => (text(9pt, font: mono, t.id), t.name)).flatten(),
  )
  text(8pt)[DISARM Framework, DISARM Foundation, CC BY-SA 4.0.]
}

#if d.counter != none {
  section("Draft public message")
  block(inset: (left: 10pt), stroke: (left: 1.2pt), d.counter)
}

#v(14pt)
#rule
#text(8.5pt, style: "italic")[Indicative assessment of coordinated inauthentic behaviour based on public data. It identifies patterns of coordination between accounts and is not an accusation against any individual.]

#pagebreak(weak: true)
#text(7.5pt, font: mono, tracking: 1pt)[ANNEX A]
#v(-6pt)
#text(14pt, weight: "bold")[Evidence integrity]
#v(6pt)
#set text(9.5pt)
#table(
  columns: (auto, 1fr),
  stroke: (x, y) => (bottom: 0.3pt + luma(160)),
  inset: (x: 0pt, y: 5pt),
  column-gutter: 12pt,
  [Report content SHA-256], text(8pt, font: mono, d.hash),
  [Evidence root SHA-256], text(8pt, font: mono, d.evidence.root),
  [Evidence posts], str(d.evidence.events),
)
#v(10pt)
#text(9pt, weight: "bold", tracking: 1pt)[CHAIN OF CUSTODY]
#table(
  columns: (auto, auto, auto, 1fr),
  stroke: (x, y) => (bottom: 0.3pt + luma(160)),
  inset: (x: 0pt, y: 5pt),
  column-gutter: 12pt,
  ..([Time], [Action], [By], [Entry hash]).map(h => text(7.5pt, font: mono, upper(h))),
  ..d.custody.map(c => (c.time, c.action, c.by, text(7.5pt, font: mono, c.hash))).flatten(),
)
