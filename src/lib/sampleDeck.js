// A stand-in deck so the card UI can be reviewed before the backend exists.
// Loaded only when someone taps "Load a sample deck" on the empty library -
// never seeded silently, so a real empty library still reads as empty.
export function makeSampleDeck() {
  const now = Date.now();
  const cards = [
    {
      front: 'Why does adding a solute lower the freezing point of a solvent?',
      back: 'Solute particles disrupt the ordered lattice the solvent needs to crystallise, so more energy must be removed before it can freeze.',
      hint: 'Think about what freezing requires structurally.',
    },
    {
      front: 'What distinguishes an SN1 from an SN2 reaction mechanism?',
      back: 'SN1 goes through a carbocation intermediate in two steps and is first-order; SN2 is a single concerted step with backside attack and is second-order.',
      hint: 'Count the steps.',
    },
    {
      front: 'Why is ATP called the energy currency of the cell?',
      back: 'Hydrolysing its terminal phosphate bond releases usable free energy, and nearly every energy-requiring pathway is coupled to that reaction.',
      hint: '',
    },
    {
      front: 'What does Le Chatelier’s principle predict when you raise the pressure on a gas equilibrium?',
      back: 'The equilibrium shifts toward whichever side has fewer moles of gas, reducing the pressure.',
      hint: 'Count moles on each side.',
    },
    {
      front: 'Why can enzymes be reused after catalysing a reaction?',
      back: 'They lower activation energy without being consumed - the enzyme is chemically unchanged once the product leaves the active site.',
      hint: '',
    },
    {
      front: 'What is the difference between an exothermic and an endothermic reaction in terms of bond energy?',
      back: 'Exothermic reactions release more energy forming bonds than they absorb breaking them; endothermic reactions absorb more than they release.',
      hint: 'Breaking costs, forming pays.',
    },
  ];

  return {
    id: `deck_sample_${now}`,
    title: 'Sample deck',
    subject: 'General Chemistry',
    createdAt: now,
    isSample: true,
    cards: cards.map((c, i) => ({
      id: `card_sample_${now}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}

// A second sample, written to the same rules from the natural-selection
// poster used in testing - so the library has two decks (which is when the
// cross-deck review and exams start to make sense) and the biology one
// looks like what a scan of that page produces.
export function makeBiologySampleDeck() {
  const now = Date.now() + 1;
  const cards = [
    {
      front: 'Why are individuals with helpful inherited traits more likely to pass them on?',
      back: 'They survive and reproduce more, so their traits become more common in the next generation.',
      hint: 'Survival, then reproduction, then inheritance.',
    },
    {
      front: 'What does "variation" mean in the context of natural selection?',
      back: 'Individuals within a population differ in their traits - the raw material selection acts on.',
      hint: '',
    },
    {
      front: 'What role does environmental pressure play in natural selection?',
      back: 'The environment creates challenges; traits that help meet them are favoured.',
      hint: '',
    },
    {
      front: 'Why does the Devils Hole pupfish count as an example of natural selection?',
      back: 'It survives in a hot desert pool with very low oxygen - a population adapted to an extreme environment.',
      hint: '',
    },
    {
      front: 'Where does the variation that natural selection acts on come from?',
      back: 'Mutations and genetic recombination.',
      hint: 'Two sources.',
    },
    {
      front: 'Does natural selection act on individuals or on populations?',
      back: 'It acts on individuals, but evolution happens in populations over many generations.',
      hint: 'The key-takeaway box.',
    },
    {
      front: 'How does natural selection influence biodiversity?',
      back: 'By shaping which traits persist, it drives the diversity of species and their roles in ecosystems.',
      hint: '',
    },
    {
      front: 'Put the five steps of how natural selection works in order.',
      back: 'Variation, environmental pressure, survival and reproduction, inheritance, evolution over time.',
      hint: '',
    },
    {
      front: 'What is the relationship between DNA, chromosomes, genes and traits?',
      back: 'DNA is packaged into chromosomes; genes are sections of DNA; traits are what genes produce, so variation in genes gives variation in traits.',
      hint: '',
    },
  ];

  return {
    id: `deck_sample_bio_${now}`,
    title: 'Natural Selection',
    subject: 'Biology',
    createdAt: now,
    isSample: true,
    sourceKind: 'image',
    cards: cards.map((c, i) => ({
      id: `card_sample_bio_${now}_${i}`,
      front: c.front,
      back: c.back,
      hint: c.hint || null,
    })),
  };
}
