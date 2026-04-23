const API_BASE = "laziz.runflare.run";
    let currentTags = [];
    let currentResults = [];
    let toastTimer = null;

    const quickSets = {
      chicken: ["مرغ", "سیر", "پیاز", "زعفران"],
      pasta: ["پاستا", "گوجه", "ریحان", "پنیر"],
      vegetarian: ["قارچ", "فلفل دلمه", "اسفناج"]
    };

    const suggestions_db = ["مرغ","گوشت","پیاز","سیر","سیب زمینی","گوجه","تخم مرغ","قارچ","فلفل دلمه","پنیر","ماست","شیر","پاستا","برنج","جعفری","گشنیز","لوبیا","نخود"];

    const input = document.getElementById('ingredient-input');
    const tagBox = document.getElementById('tag-box');
    const suggestEl = document.getElementById('suggestions');
    let selectedMeal = "";
    let selectedTime = "";
    let selectedDifficulty = "";

    document.querySelectorAll(".filter-chip").forEach(chip => {

    chip.addEventListener("click", () => {

    const group = chip.dataset.filter;

    document.querySelectorAll(`.filter-chip[data-filter="${group}"]`)
    .forEach(c => c.classList.remove("active"));

    chip.classList.add("active");

    const value = chip.dataset.value;

    if(group === "meal") selectedMeal = value;
    if(group === "time") selectedTime = value;
    if(group === "difficulty") selectedDifficulty = value;

    });

    });

    // Input Logic
    tagBox.addEventListener('click', () => input.focus());
    input.addEventListener('keydown', (e) => {
      // Support both English and Farsi commas
      if ((e.key === 'Enter' || e.key === ',' || e.key === '،') && input.value.trim()) {
        e.preventDefault();
        addTag(input.value.trim().replace(/[,،]$/, ''));
        input.value = '';
        hideSuggestions();
      } else if (e.key === 'Backspace' && !input.value && currentTags.length) {
        removeTag(currentTags.length - 1);
      }
    });

    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (!val) { hideSuggestions(); return; }
      const matches = suggestions_db.filter(s => s.startsWith(val) && !currentTags.includes(s)).slice(0, 6);
      renderSuggestions(matches);
    });

    function renderSuggestions(items) {
      if (!items.length) { hideSuggestions(); return; }
      suggestEl.innerHTML = items.map(i => `<div class="suggestion-item" onclick="addTag('${i}'); input.value=''; hideSuggestions();">${i}</div>`).join('');
      suggestEl.classList.add('visible');
    }

    function hideSuggestions() { suggestEl.classList.remove('visible'); }

    function addTag(val) {
      if (!val || currentTags.includes(val)) return;
      currentTags.push(val);
      renderTags();
    }

    function removeTag(idx) { currentTags.splice(idx, 1); renderTags(); }

    function renderTags() {
      tagBox.querySelectorAll('.tag').forEach(t => t.remove());
      currentTags.forEach((tag, idx) => {
        const el = document.createElement('span');
        el.className = 'tag';
        el.innerHTML = `${tag}<button class="tag-remove" onclick="removeTag(${idx})"><i class="fa-solid fa-xmark"></i></button>`;
        tagBox.insertBefore(el, input);
      });
    }

    function addQuickSet(name) {
      quickSets[name].forEach(i => addTag(i));
      showToast("مواد با موفقیت اضافه شدند");
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toast-msg').textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
    }

    async function searchRecipes() {
      if (!currentTags.length) { showToast("لطفاً حداقل یک ماده غذایی وارد کنید"); return; }

      const resultsSection = document.getElementById('results-section');
      const loading = document.getElementById('loading');
      const empty = document.getElementById('empty-state');
      const container = document.getElementById('results-container');
      const btn = document.getElementById('search-btn');

      resultsSection.style.display = "block";
      loading.classList.add("visible");
      empty.style.display = "none";
      container.innerHTML = "";
      btn.disabled = true;

      try {
        const query = encodeURIComponent(currentTags.join(","));
        const mealType = selectedMeal;
        const cookTime = selectedTime;
        const difficulty = selectedDifficulty;

        let url = `${API_BASE}/recommend?ingredients=${query}&top_k=20`;
        if (mealType) url += `&meal_type=${encodeURIComponent(mealType)}`;
        if (cookTime) url += `&cook_time=${encodeURIComponent(cookTime)}`;
        if (difficulty) url += `&difficulty=${encodeURIComponent(difficulty)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Server Error");
        const data = await res.json();

        loading.classList.remove("visible");
        btn.disabled = false;

        if (!data.results || data.results.length === 0) {
          empty.style.display = "block";
          return;
        }

        currentResults = data.results;
        renderResults(data.results);
      } catch (err) {
        console.error("Error Detail:", err);
        loading.classList.remove("visible");
        btn.disabled = false;
        showToast("خطا در اتصال به سرور");
      }
    }

    function renderResults(results) {
      const container = document.getElementById('results-container');
      const header = `
        <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
          <h3>نتایج برای: <span style="color:var(--accent)">${currentTags.join("، ")}</span></h3>
          <span style="font-size:13px">${results.length} مورد پیدا شد</span>
        </div>
      `;
      const cards = results.map((r, i) => createCard(r, i)).join("");
      container.innerHTML = header + `<div class="cards-grid">${cards}</div>`;
    }

    function createCard(recipe, idx) {
      const img = recipe.image ? `<img src="${recipe.image}">` : `🍳`;
      const ingredients = (recipe.ingredients_names || []).slice(0, 5).map(i => {
          const isMatched = currentTags.some(t => i.includes(t));
          return `<span class="ing-chip ${isMatched ? 'matched' : ''}">${i}</span>`;
      }).join("");

      return `
        <div class="recipe-card" onclick="openModal(${idx})">
          <div class="card-img-wrap">${img}</div>
          <div class="card-body">
            <div class="card-title">${recipe.title}</div>
            <div class="card-meta">
              <span><i class="fa-solid fa-clock"></i> ${recipe.recipe_cook_time || 0}</span>
<!--              <span><i class="fa-solid fa-clock"></i> ${recipe.recipe_prep_time || 0} زمان آماده سازی</span>-->
              <span><i class="fa-solid fa-layer-group"></i> ${recipe.recipe_difficulty || 'ساده'}</span>
            </div>
            <div>${ingredients}</div>
          </div>
        </div>
      `;
    }

    function openModal(idx) {
      const r = currentResults[idx];
      const inner = document.getElementById("modal-inner");

    const ingList = (r.ingredients || []).map(i => {
    let amount;

    if (!i.quantity && !i.unit) {
        amount = "به مقدار لازم";
    } else {
    amount = `${i.quantity || ''} ${i.unit || ''}`.trim();
    }

    return `
        <div style="padding:8px; border-bottom:1px solid var(--border); font-size:14px;">
        <b>${i.name || ''}</b>: ${amount}
        </div>
    `;
    }).join("");


      const steps = (r.instructions || []).map((s, i) => `
        <div class="instruction-step">
          <div class="step-num">${i + 1}</div>
          <div class="step-text">${s}</div>
        </div>
      `).join("");

      inner.innerHTML = `
        <div class="modal-hero">
          ${r.image ? `<img src="${r.image}">` : ''}
          <div class="modal-hero-content"><h2>${r.title}</h2></div>
        </div>
        <div class="modal-body">
          <div>
            <h4 style="color:var(--accent); margin-bottom:15px;"><i class="fa-solid fa-list"></i> مواد لازم</h4>
            ${ingList}
          </div>
          <div>
            <h4 style="color:var(--accent); margin-bottom:15px;"><i class="fa-solid fa-utensils"></i> طرز تهیه</h4>
            ${steps}
          </div>
        </div>
      `;
      document.getElementById("modal-overlay").classList.add("open");
    }

    function closeModal() { document.getElementById("modal-overlay").classList.remove("open"); }
    function handleOverlayClick(e) { if (e.target.id === "modal-overlay") closeModal(); }
