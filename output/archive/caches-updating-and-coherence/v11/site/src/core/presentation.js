"use strict";

(() => {
  const deck = document.getElementById("deck");
  const nav = document.getElementById("slide-nav");
  const progressBar = document.getElementById("progress-bar");
  const data = window.__PRESENTATION_DATA__ || { slides: [] };
  const slides = Array.isArray(data.slides) ? data.slides : [];
  let current = 0;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderShell() {
    if (!deck || !nav) return;

    deck.innerHTML = slides
      .map((slide, index) => {
        const bullets = Array.isArray(slide.body) && slide.body.length
          ? '<ul class="bullet-list">' + slide.body.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
          : '';
        const note = slide.note ? '<p class="slide-copy">' + escapeHtml(slide.note) + '</p>' : '';
        const image = slide.image ? '<figure class="slide-visual"><img src="' + encodeURI(slide.image) + '" alt="' + escapeHtml(slide.title) + ' image"></figure>' : '';

        return '<section class="slide' + (index === 0 ? ' is-active' : '') + '" data-slide-index="' + index + '">' +
          '<div class="slide-shell">' +
            '<header class="slide-header">' +
              '<span class="slide-kicker">' + escapeHtml(slide.kicker || ('Slide ' + (index + 1))) + '</span>' +
              '<h2>' + escapeHtml(slide.title) + '</h2>' +
            '</header>' +
            '<div class="slide-body">' +
              '<div class="slide-copy-wrap">' + bullets + note + '</div>' +
              image +
            '</div>' +
          '</div>' +
        '</section>';
      })
      .join('');

    nav.innerHTML = slides
      .map((slide, index) => '<button class="nav-item' + (index === 0 ? ' is-active' : '') + '" type="button" data-target-index="' + index + '">' + escapeHtml(slide.title) + '</button>')
      .join('');

    Array.from(nav.querySelectorAll(".nav-item")).forEach((item) => {
      item.addEventListener("click", () => render(Number(item.dataset.targetIndex || 0)));
    });
  }

  function render(index) {
    const slideNodes = Array.from(document.querySelectorAll(".slide"));
    const navItems = Array.from(document.querySelectorAll(".nav-item"));
    current = Math.max(0, Math.min(index, slideNodes.length - 1));

    slideNodes.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === current);
    });

    navItems.forEach((item, navIndex) => {
      item.classList.toggle("is-active", navIndex === current);
    });

    if (progressBar) {
      const progress = slideNodes.length > 1 ? ((current + 1) / slideNodes.length) * 100 : 100;
      progressBar.style.width = progress + "%";
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") render(current + 1);
    if (event.key === "ArrowLeft") render(current - 1);
    if (event.key === "Home") render(0);
    if (event.key === "End") render(slides.length - 1);
    if (event.key.toLowerCase() === "f") toggleFullscreen();
  });

  renderShell();
  render(0);
})();