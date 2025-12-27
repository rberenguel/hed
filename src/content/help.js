(() => {
  const HELP_HTML = `
<div class="hed-help">
  <div class="hed-help-header">HED Features <span>(standard ed commands not shown)</span></div>
  <div class="hed-help-cols">
    <section>
      <h4>Highlighting</h4>
      <div>/regex/H - Live highlight</div>
      <div>e H - Edit patterns</div>
      <div>0H, 1H... - Toggle pattern</div>
    </section>
    <section>
      <h4>Selection</h4>
      <div>/regex/S - Extract to CSV</div>
    </section>
    <section>
      <h4>Shell Commands</h4>
      <div>!sort - Sort lines</div>
      <div>!? - Command help</div>
    </section>
    <section>
      <h4>Notes</h4>
      <div>e, 0e - Edit note 0</div>
      <div>1e, 2e... - Edit note N</div>
      <div>ce - Edit clipboard</div>
      <div>w - Save note</div>
    </section>
    <section>
      <h4>Note Colors</h4>
      <div># .y/.b/.g/.r/.t - Colors</div>
      <div># .scpp/.sjs/.spy - Code</div>
      <div># .sts/.srust/.sgo - More</div>
      <div># .sjava/.sbash/.sjson</div>
    </section>
    <section>
      <h4>Note Lines</h4>
      <div>- [ ] / - [x] - Checkbox</div>
      <div>* text - Copy button</div>
      <div>- text - Bullet</div>
    </section>
    <section>
      <h4>Context</h4>
      <div>textarea/input → field</div>
      <div>contenteditable → element</div>
      <div>note → that note</div>
      <div>nothing → clipboard</div>
    </section>
  </div>
</div>
`;

  // Export help HTML
  window.hedHelp = {
    getHelpHTML: () => HELP_HTML,
  };
})();
