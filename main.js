document.addEventListener('DOMContentLoaded', () => {
    const dietForm = document.getElementById('diet-form');
    const resultsPanel = document.getElementById('results-section');
    const generateBtn = document.getElementById('generate-btn');
    const btnLoader = document.getElementById('btn-loader');
    const btnText = generateBtn.querySelector('span');
    const riskAlertsContainer = document.getElementById('risk-alerts-container');
    const riskAlertsList = document.getElementById('risk-alerts-list');

    let currentPlan = {};
    let currentData = {};

    // ─── Form Submit ───
    dietForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);

        currentData = {
            name: document.getElementById('patientName').value,
            age: document.getElementById('age').value,
            weight: document.getElementById('weight').value,
            conditions: Array.from(document.querySelectorAll('input[name="condition"]:checked')).map(cb => cb.value),
            dietPreference: document.getElementById('dietPreference').value,
            calorieTarget: parseInt(document.getElementById('calorieTarget').value) || 2000,
            allergies: document.getElementById('allergies').value.toLowerCase().split(',').map(s => s.trim()).filter(s => s)
        };

        await new Promise(r => setTimeout(r, 1200));

        currentPlan = generateMealPlan(currentData);
        renderAll(currentData, currentPlan);

        setLoading(false);
        resultsPanel.classList.remove('hidden');

        if (window.innerWidth < 1024) {
            resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    function setLoading(on) {
        btnLoader.style.display = on ? 'block' : 'none';
        btnText.innerHTML = on ? 'AI Processing...' : '<i data-lucide="zap"></i> Generate Meal Plan';
        generateBtn.disabled = on;
        lucide.createIcons();
    }

    // ─── AI Meal Generation ───
    function generateMealPlan(data) {
        const rules = getRules(data.conditions);
        const pool = mealsDB.filter(m => {
            if (!m.diet.includes(data.dietPreference)) return false;
            if (data.allergies.some(a => m.name.toLowerCase().includes(a))) return false;
            return true;
        });

        const score = (m) => {
            let s = 0;
            rules.forEach(r => { if (m.tags.includes(r)) s += 10; });
            data.conditions.forEach(c => { if (m.tags.includes(c)) s += 20; });
            return s;
        };

        const sorted = pool.map(m => ({ ...m, score: score(m) })).sort((a, b) => b.score - a.score);

        return {
            Breakfast: sorted.find(m => m.type === 'Breakfast') || mealsDB.find(m => m.type === 'Breakfast'),
            Lunch:     sorted.find(m => m.type === 'Lunch')     || mealsDB.find(m => m.type === 'Lunch'),
            Dinner:    sorted.find(m => m.type === 'Dinner')    || mealsDB.find(m => m.type === 'Dinner')
        };
    }

    function getRules(conditions) {
        const r = [];
        if (conditions.includes('Diabetes'))      r.push('Low Sugar', 'High Fiber');
        if (conditions.includes('Hypertension'))   r.push('Low Salt');
        if (conditions.includes('Heart Disease'))  r.push('Low Fat');
        if (conditions.includes('Anemia'))         r.push('Iron-Rich');
        return r;
    }

    // ─── Render Everything ───
    function renderAll(data, plan) {
        renderGraphs(data, plan);
        renderRiskAlerts(data.conditions);
        renderMealCards(plan);
        renderTips(data.conditions);
        lucide.createIcons();
    }

    function renderGraphs(data, plan) {
        const meals = Object.values(plan);
        const t = {
            cal:   meals.reduce((s, m) => s + m.calories, 0),
            prot:  meals.reduce((s, m) => s + m.protein, 0),
            carbs: meals.reduce((s, m) => s + m.carbs, 0),
            fats:  meals.reduce((s, m) => s + m.fats, 0)
        };

        const scale = data.calorieTarget / 2000;
        const set = (id, cur, max, valId, unit) => {
            const perc = Math.min(100, (cur / max) * 100);
            document.getElementById(id).style.width = perc + '%';
            document.getElementById(valId).textContent = cur + unit;
        };

        set('bar-calories', t.cal,   data.calorieTarget, 'val-cal',   ' kcal');
        set('bar-protein',  t.prot,  100 * scale,        'val-prot',  'g');
        set('bar-carbs',    t.carbs, 250 * scale,        'val-carbs', 'g');
        set('bar-fats',     t.fats,  65 * scale,         'val-fats',  'g');
    }

    function renderRiskAlerts(conditions) {
        const map = {
            'Diabetes':      '⚠ Avoid high sugar & simple carbs. Monitor glycemic index.',
            'Hypertension':  '⚠ Limit sodium intake. Avoid canned/processed foods.',
            'Heart Disease':  '⚠ Reduce saturated & trans fats. Increase Omega-3.',
            'Anemia':        '⚠ Pair iron-rich foods with Vitamin C for absorption.'
        };
        const alerts = conditions.map(c => map[c]).filter(Boolean);
        if (alerts.length) {
            riskAlertsContainer.classList.remove('hidden');
            riskAlertsList.innerHTML = alerts.map(a => `<li>${a}</li>`).join('');
        } else {
            riskAlertsContainer.classList.add('hidden');
        }
    }

    function renderMealCards(plan) {
        const grid = document.getElementById('meal-plan-grid');
        grid.innerHTML = '';
        Object.entries(plan).forEach(([type, meal]) => {
            const card = document.createElement('div');
            card.className = 'meal-card';
            card.dataset.type = type;
            card.innerHTML = `
                <div>
                    <div class="meal-type">${type}</div>
                    <div class="meal-title"><i data-lucide="${meal.icon}"></i> ${meal.name}</div>
                    <div class="meal-stats">
                        <span>🔥 ${meal.calories} kcal</span>
                        <span>🥩 ${meal.protein}g P</span>
                        <span>🥑 ${meal.fats}g F</span>
                    </div>
                </div>
                <button class="btn-swap" onclick="swapMeal('${type}', ${meal.id})">
                    ↻ Alternative
                </button>
            `;
            grid.appendChild(card);
        });
    }

    // ─── Meal Swap (Global) ───
    window.swapMeal = (type, currentId) => {
        const pool = mealsDB.filter(m =>
            m.type === type &&
            m.id !== currentId &&
            m.diet.includes(currentData.dietPreference) &&
            !currentData.allergies.some(a => m.name.toLowerCase().includes(a))
        );
        if (pool.length) {
            currentPlan[type] = pool[Math.floor(Math.random() * pool.length)];
            renderAll(currentData, currentPlan);
            const card = document.querySelector(`.meal-card[data-type="${type}"]`);
            if (card) card.style.animation = 'mealFlash 0.4s ease';
        }
    };

    function renderTips(conditions) {
        const tipMap = {
            'Diabetes':     ['Complex carbs only — avoid white rice/bread.', 'Avoid fruit juices.'],
            'Hypertension': ['Low sodium focus.', 'Increase potassium-rich foods.'],
            'Heart Disease': ['Omega-3 fatty acids preferred.', 'Limit butter and red meat.'],
            'Anemia':       ['Iron + Vitamin C pairing.', 'Avoid tea immediately after meals.'],
            'Healthy':      ['Stay well hydrated.', 'Eat a variety of colorful foods.']
        };
        let tips = [];
        conditions.forEach(c => tips = tips.concat(tipMap[c] || []));
        if (!tips.length) tips = tipMap['Healthy'];
        document.getElementById('ai-tips-list').innerHTML = tips.slice(0, 4).map(t => `<li>${t}</li>`).join('');
    }
});
