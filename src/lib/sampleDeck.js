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
