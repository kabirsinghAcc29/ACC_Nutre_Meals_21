/* eslint-disable eol-last */
window.acceleratedDataQueue = window.acceleratedDataQueue || [];
window.acceleratedDataQueue.push({
            'ACC_Nutre_Meals_21': {
                vars: {
                    pathPattern: /^\/meals\/?$/,
                    minimum: 5,
                    tiers: [10, 15, 20],
                    fallbackPrices: [14.25, 13.49, 12.99, 12.49],

                    badges: [
                        { pattern: /^★?\s*premium$/i, type: 'premium', label: 'Premium' },
                        { pattern: /^fresh on the menu$/i, type: 'fresh', label: 'Fresh on the menu' },
                        { pattern: /^(customer )?favou?rite$/i, type: 'favorite', label: 'Customer favorite' }
                    ],

                    cautiousPattern: /cautious/i,

                    portionPattern: /^(regular|protein\s*\+)/i,
                    addTextPattern: /^add\b/i,
                    ignoreLeaf: /^(\d+(\.\d+)?g?|cal|carbs?|protein|fat|[+-]?\$[\d.,]+|regular|protein\s*\+.*|add\b.*|\d+)$/i,

                    cartCountPattern: /^\d+\s*meals?(\s*[,&+]?\s*\d+\s*add[\s-]*ons?)?$/i,
                    mealCountPattern: /(\d+)\s*meals?\b/i,

                    // Cart header height as a CSS variable:
                    // the height of `header` is written to `variable` on `target`.
                    // Use it in the CSS as: var(--ACC_Nutre_Meals_21-header-height, 0px)
                    headerHeight: {
                        header: '.main-wrapper.mealsPage .isMealsPage.cartWrapper .ACC_Nutre_Meals_21_headbg',
                        target: '.ACC_Nutre_Meals_21 .main-wrapper.mealsPage .isMealsPage.cartWrapper:not(.openMobileCart)',
                        variable: '--ACC_Nutre_Meals_21-header-height'
                    }
                },

                observer: null,
                scheduled: false,

                text(element) {
                    return (element && (element.innerText || element.textContent) || '').replace(/\s+/g, ' ').trim();
                },

                escapeHTML(value) {
                    const div = document.createElement('div');

                    div.textContent = value;

                    return div.innerHTML;
                },

                icon(type) {
                    const paths = {
                        plus: 'M7 1.5v11M1.5 7h11',
                        minus: 'M1.5 7h11'
                    };

                    return `<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="${paths[type]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
                },

                isNutritionCard(element) {
                    const value = element.textContent;
                    const macros = [/\d\s*g?\s*carb/i, /\d\s*g?\s*protein/i, /\d\s*g?\s*fat/i].filter((re) => re.test(value)).length;

                    return /\d\s*cal/i.test(value) && macros >= 1;
                },

                findCards(tn) {
                    const images = Array.from(document.querySelectorAll('main img, #__next img')).filter((img) => !img.closest(`.${tn}_card`));
                    const roots = [];

                    images.forEach((img) => {
                        let node = img.parentElement;

                        while (node && node !== document.body) {
                            const nativeImages = Array.from(node.querySelectorAll('img')).filter((element) => !element.closest(`.${tn}_card`));

                            if (nativeImages.length > 1) {
                                node = null;
                                break;
                            }

                            if (this.isNutritionCard(node) && Array.from(node.querySelectorAll('button')).some((button) => !button.closest(`.${tn}_card`))) {
                                break;
                            }

                            node = node.parentElement;
                        }

                        if (node && node !== document.body && roots.indexOf(node) === -1) {
                            roots.push(node);
                        }
                    });

                    return roots;
                },

                imageSrc(root) {
                    const own = `.${this.__testName}_card`;
                    const img = Array.from(root.querySelectorAll('img')).find((element) => !element.closest(own));
                    const real = (value) => (value && !/^data:/i.test(value.trim()) ? value.trim() : '');
                    const fromSet = (value) => {
                        // largest candidate of a srcset ("url 640w, url 1080w")
                        const list = String(value || '').split(',').map((part) => part.trim().split(/\s+/)).filter((part) => real(part[0]));

                        list.sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));

                        return list.length ? list[0][0] : '';
                    };

                    if (!img) {
                        return '';
                    }

                    const picture = img.closest('picture');
                    const noscript = (img.parentElement && img.parentElement.querySelector('noscript')) || root.querySelector('noscript');
                    const noscriptSrc = noscript ? ((noscript.textContent || '').match(/src="([^"]+)"/) || [])[1] : '';
                    const candidates = [
                        img.currentSrc,
                        img.getAttribute('src'),
                        fromSet(img.getAttribute('srcset')),
                        img.getAttribute('data-src'),
                        fromSet(img.getAttribute('data-srcset')),
                        picture ? fromSet((picture.querySelector('source[srcset]') || { getAttribute: () => '' }).getAttribute('srcset')) : '',
                        noscriptSrc ? noscriptSrc.replace(/&amp;/g, '&') : ''
                    ];

                    for (let i = 0; i < candidates.length; i += 1) {
                        if (real(candidates[i])) {
                            try {
                                return new URL(real(candidates[i]), document.baseURI).href;
                            } catch (error) {
                                return real(candidates[i]);
                            }
                        }
                    }

                    return img.currentSrc || img.getAttribute('src') || '';
                },

                isReady(data, root) {
                    if (!data.name || !data.image) {
                        return false;
                    }

                    if (!/^data:/i.test(data.image)) {
                        return true;
                    }

                    const img = Array.from(root.querySelectorAll('img')).find((element) => !element.closest(`.${this.__testName}_card`));

                    if (img && img.complete && img.naturalWidth > 16) {
                        return true;
                    }

                    this.firstSeen = this.firstSeen || {};
                    this.firstSeen[data.name] = this.firstSeen[data.name] || Date.now();

                    return Date.now() - this.firstSeen[data.name] > 3000;
                },

                leaves(root, tn) {
                    return Array.from(root.querySelectorAll('*')).filter((element) => {
                        return !element.closest(`.${tn}_card`) &&
                            !element.closest('button, label, [role="button"], [role="radio"], input, select') &&
                            element.children.length === 0 &&
                            this.text(element);
                    });
                },

                readCard(root, tn) {
                    const img = root.querySelector('img');
                    const flatParts = [];
                    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                        acceptNode: (node) => (node.parentElement && node.parentElement.closest(`.${tn}_card`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
                    });

                    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                        flatParts.push(node.nodeValue);
                    }

                    const flat = flatParts.join(' ').replace(/\s+/g, ' ').replace(/(\d)\s+\.\s*(\d)/g, '$1.$2');
                    const pick = (re) => {
                        const match = flat.match(re);

                        return match ? match[1] : '';
                    };
                    const data = {
                        image: this.imageSrc(root),
                        alt: img ? (img.getAttribute('alt') || '') : '',
                        name: '',
                        cal: pick(/(?<![\d.])(\d+(?:\.\d+)?)\s*cal\b/i),
                        carb: pick(/(?<![\d.])(\d+(?:\.\d+)?\s*g)\s*carb/i).replace(/\s/g, ''),
                        protein: pick(/(?<![\d.])(\d+(?:\.\d+)?\s*g)\s*protein/i).replace(/\s/g, ''),
                        fat: pick(/(?<![\d.])(\d+(?:\.\d+)?\s*g)\s*fat/i).replace(/\s/g, ''),
                        tags: [],
                        badges: [],
                        qty: 0,
                        portions: []
                    };

                    const heading = root.querySelector('h1, h2, h3, h4, h5, h6');

                    this.leaves(root, tn).forEach((leaf) => {
                        const value = this.text(leaf);

                        if (this.vars.ignoreLeaf.test(value) || value.length > 60) {
                            return;
                        }

                        const badge = this.vars.badges.find((item) => item.pattern.test(value));

                        if (badge) {
                            if (!data.badges.some((item) => item.type === badge.type)) {
                                data.badges.push({ type: badge.type, label: badge.label });
                            }
                            return;
                        }

                        if (heading ? heading.contains(leaf) : !data.name && value.length > 3) {
                            data.name = data.name || value;
                            return;
                        }

                        if (value !== data.name && data.tags.indexOf(value) === -1 && value.length <= 30) {
                            data.tags.push(value);
                        }
                    });

                    data.name = data.name || (heading ? this.text(heading) : data.alt);

                    data.tags.sort((a, b) => Number(this.vars.cautiousPattern.test(a)) - Number(this.vars.cautiousPattern.test(b)));

                    const buttons = Array.from(root.querySelectorAll('button, [role="button"], [role="radio"], label')).filter((button) => {
                        return !button.closest(`.${tn}_card`);
                    });

                    data.portions = buttons.filter((button) => this.vars.portionPattern.test(this.text(button))).map((button) => {
                        return { label: this.text(button).replace(/\s*\+\s*\$[\d.]+.*/, ''), active: this.isActive(button, buttons) };
                    });

                    const priceLeaves = Array.from(root.querySelectorAll('*')).filter((element) => {
                        return element.children.length === 0 &&
                            !element.closest(`.${tn}_card`) &&
                            !element.closest('button, label, [role="button"], [role="radio"]') &&
                            /^\$\s*[\d,]+(?:\.\d+)?$/.test(this.text(element));
                    });
                    const struck = (element) => Boolean(element.closest('s, del, strike')) ||
                        /line-through/.test(getComputedStyle(element).textDecorationLine || '');

                    data.price = (priceLeaves.find((element) => !struck(element)) || { textContent: '' }).textContent.replace(/\s+/g, '').trim();
                    data.comparePrice = (priceLeaves.find((element) => struck(element)) || { textContent: '' }).textContent.replace(/\s+/g, '').trim();

                    const activePortion = data.portions.length > 1 ? (data.portions.find((portion) => portion.active) || {}).label : '';

                    data.qty = this.readQty(root, data.name, activePortion);

                    return data;
                },

                hiddenBySite(element, root) {
                    const native = `${this.__testName}_native`;
                    const lifted = root.classList.contains(native);
                    let hidden = false;

                    if (lifted) {
                        root.classList.remove(native);
                    }

                    for (let node = element; node && node !== root; node = node.parentElement) {
                        const style = getComputedStyle(node);

                        if (style.display === 'none' || style.visibility === 'hidden' || node.hidden || node.getAttribute('aria-hidden') === 'true') {
                            hidden = true;
                            break;
                        }
                    }

                    if (lifted) {
                        root.classList.add(native);
                    }

                    return hidden;
                },

                visibleAddButton(root) {
                    return this.stepButtons(root).find((button) => {
                        return this.vars.addTextPattern.test(this.text(button)) && !this.hiddenBySite(button, root);
                    }) || null;
                },

                stepDirection(button) {
                    const attrs = (element) => ['aria-label', 'title', 'data-testid', 'data-icon', 'name'].map((name) => element.getAttribute(name) || '').join(' ');
                    const icons = Array.from(button.querySelectorAll('svg, i, span, use')).map((element) => {
                        return `${attrs(element)} ${element.getAttribute('class') || ''} ${element.getAttribute('href') || element.getAttribute('xlink:href') || ''}`;
                    }).join(' ');
                    const label = `${attrs(button)} ${icons}`;
                    const value = this.text(button);

                    if (/^[-−–]$/.test(value) || /(remove|delete|trash|bin\b|decrease|decrement|minus|subtract)/i.test(label)) {
                        return 'minus';
                    }

                    if (/^\+$/.test(value) || /(\badd|increase|increment|plus)/i.test(label)) {
                        return 'plus';
                    }

                    return '';
                },

                isDisabled(button) {
                    return Boolean(button.disabled) || button.getAttribute('aria-disabled') === 'true' ||
                        /(^|\s)Mui-disabled(\s|$)/.test(button.getAttribute('class') || '');
                },

                splitStepper(buttons, qtyNode) {
                    const usable = buttons.filter((button) => !this.isDisabled(button) && !button.contains(qtyNode));
                    const before = usable.filter((button) => qtyNode.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING);
                    const after = usable.filter((button) => qtyNode.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
                    const explicit = (direction) => usable.find((button) => this.stepDirection(button) === direction) || null;
                    let minus = before.length ? before[before.length - 1] : null;
                    let plus = after.length ? after[0] : null;

                    if (minus && plus && this.stepDirection(minus) === 'plus' && this.stepDirection(plus) === 'minus') {
                        [minus, plus] = [plus, minus];
                    }

                    minus = minus || explicit('minus');
                    plus = plus || explicit('plus');

                    if (minus && this.stepDirection(minus) === 'plus') {
                        minus = explicit('minus');
                    }

                    if (plus && this.stepDirection(plus) === 'minus') {
                        plus = explicit('plus');
                    }

                    if (minus === plus) {
                        minus = null;
                    }

                    return { minus, plus };
                },

                nativeStepper(root) {
                    const own = `.${this.__testName}_card`;
                    const qtyNode = Array.from(root.querySelectorAll('input')).find((element) => {
                        return !element.closest(own) && /^\d+$/.test(String(element.value).trim()) &&
                            !/^(checkbox|radio|hidden)$/i.test(element.type) && !this.hiddenBySite(element, root);
                    }) || this.findQtyLeaf(root);

                    if (!qtyNode) {
                        return null;
                    }

                    const row = this.controlRow(qtyNode);
                    const buttons = row ? this.stepButtons(row).filter((button) => {
                        return !this.hiddenBySite(button, root) && !this.vars.addTextPattern.test(this.text(button));
                    }) : [];

                    if (buttons.length < 2) {
                        return null;
                    }

                    const steps = this.splitStepper(buttons, qtyNode);

                    return {
                        qty: parseInt(qtyNode.tagName === 'INPUT' ? qtyNode.value : this.text(qtyNode), 10) || 0,
                        minus: steps.minus,
                        plus: steps.plus
                    };
                },

                readQty(root, name, portion) {
                    const stepper = this.nativeStepper(root);

                    if (stepper) {
                        return stepper.qty;
                    }

                    return this.drawerQty(name, portion);
                },

                rowPortion(row) {
                    return /protein\s*\+|protein\s*plus/i.test(row.textContent) ? 'protein' : 'regular';
                },

                portionKey(label) {
                    return /protein/i.test(String(label || '')) ? 'protein' : 'regular';
                },

                drawerRows(name, portion) {
                    const target = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();

                    if (!target) {
                        return [];
                    }

                    const rows = [];

                    if (!this.textIndex) {
                        const own = `.${this.__testName}_card, .${this.__testName}_native, .${this.__testName}_progress`;

                        this.textIndex = {};
                        Array.from(document.querySelectorAll('body *')).forEach((element) => {
                            if (element.children.length > 1 || element.closest(own)) {
                                return;
                            }

                            const key = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

                            if (key && key.length < 80) {
                                (this.textIndex[key] = this.textIndex[key] || []).push(element);
                            }
                        });
                    }

                    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const nameRe = new RegExp(`^${escaped}(\\s*[-–(,·|:]?\\s*(regular|protein\\s*(\\+|plus))\\)?)?$`, 'i');
                    const elements = Object.keys(this.textIndex).filter((key) => nameRe.test(key)).reduce((list, key) => list.concat(this.textIndex[key]), []);

                    const qtyCount = (node) => Array.from(node.querySelectorAll('input, *')).filter((item) => {
                        if (item.tagName === 'INPUT') {
                            return /^\d+$/.test(String(item.value).trim()) && !/^(checkbox|radio|hidden)$/i.test(item.type);
                        }

                        return item.children.length === 0 && /^\d+$/.test(this.text(item)) && !item.closest('button, [role="button"]');
                    }).length;

                    elements.forEach((element) => {
                        let row = element.parentElement;

                        for (let i = 0; row && row !== document.body && i < 6; i += 1) {
                            if (this.isNutritionCard(row)) {
                                row = null;
                                break;
                            }

                            if (row.querySelectorAll('button, [role="button"]').length >= 2) {
                                break;
                            }

                            row = row.parentElement;
                        }

                        if (row && qtyCount(row) > 1) {
                            row = null;
                        }

                        if (row && row !== document.body && rows.indexOf(row) === -1 && !rows.some((item) => item.contains(row))) {
                            rows.push(row);
                        }
                    });

                    return portion ? rows.filter((row) => this.rowPortion(row) === this.portionKey(portion)) : rows;
                },

                drawerStepper(row) {
                    const buttons = Array.from(row.querySelectorAll('button, [role="button"]'));
                    const steps = buttons.filter((button) => !/^remove$/i.test(this.text(button)));
                    const removeLink = buttons.find((button) => /^remove$/i.test(this.text(button))) || null;
                    const qtyNode = Array.from(row.querySelectorAll('input')).find((element) => {
                        return /^\d+$/.test(String(element.value).trim()) && !/^(checkbox|radio|hidden)$/i.test(element.type);
                    }) || Array.from(row.querySelectorAll('*')).find((element) => {
                        return element.children.length === 0 && /^\d+$/.test(this.text(element)) && !element.closest('button, [role="button"]');
                    });

                    if (qtyNode) {
                        const split = this.splitStepper(steps, qtyNode);

                        return { minus: split.minus || removeLink, plus: split.plus };
                    }

                    const explicit = (direction) => steps.find((button) => !this.isDisabled(button) && this.stepDirection(button) === direction) || null;

                    return { minus: explicit('minus') || removeLink, plus: explicit('plus') };
                },

                drawerQty(name, portion) {
                    return this.drawerRows(name, portion).reduce((total, row) => {
                        const input = row.querySelector('input');
                        const leaf = Array.from(row.querySelectorAll('*')).find((element) => {
                            return element.children.length === 0 && /^\d+$/.test(this.text(element));
                        });
                        const value = input && /^\d+$/.test(String(input.value).trim()) ? input.value : (leaf ? this.text(leaf) : '0');

                        return total + (parseInt(value, 10) || 0);
                    }, 0);
                },

                stepButtons(node) {
                    return Array.from(node.querySelectorAll('button, [role="button"]')).filter((button) => {
                        return !button.closest(`.${this.__testName}_card`) && !this.vars.portionPattern.test(this.text(button));
                    });
                },

                findQtyLeaf(root) {
                    return Array.from(root.querySelectorAll('*')).find((element) => {
                        return element.children.length === 0 &&
                            !element.closest(`.${this.__testName}_card`) &&
                            /^\d+$/.test(this.text(element)) &&
                            !/(cal|carb|protein|fat)/i.test(this.text(element.parentElement)) &&
                            !element.closest('button, label, [role="button"], [role="radio"]') &&
                            this.controlRow(element) &&
                            !this.hiddenBySite(element, root);
                    });
                },

                controlRow(element) {
                    let node = element.parentElement;

                    for (let i = 0; node && i < 3; i += 1) {
                        if (this.stepButtons(node).length >= 2) {
                            return node;
                        }

                        node = node.parentElement;
                    }

                    return null;
                },

                isActive(button, all) {
                    const attrs = ['aria-pressed', 'aria-checked', 'aria-selected', 'data-state', 'data-active', 'data-selected'];

                    for (let i = 0; i < attrs.length; i += 1) {
                        const value = button.getAttribute(attrs[i]);

                        if (value !== null) {
                            return /^(true|on|checked|active|1)$/i.test(value);
                        }
                    }

                    const input = button.querySelector('input') || (button.htmlFor && document.getElementById(button.htmlFor));

                    if (input && 'checked' in input) {
                        return input.checked;
                    }

                    const bg = (element) => getComputedStyle(element).backgroundColor;
                    const plain = /^(rgba\(0, 0, 0, 0\)|transparent|rgb\(255, 255, 255\))$/;
                    const siblings = all.filter((item) => this.vars.portionPattern.test(this.text(item)));

                    return !plain.test(bg(button)) && siblings.some((item) => item !== button && plain.test(bg(item)));
                },

                nativeAction(root, action, value) {
                    const buttons = Array.from(root.querySelectorAll('button, [role="button"], [role="radio"], label')).filter((button) => {
                        return !button.closest(`.${this.__testName}_card`);
                    });

                    if (action === 'portion') {
                        const target = buttons.find((button) => this.text(button).toLowerCase().indexOf(value.toLowerCase()) === 0);

                        return target && target.click();
                    }

                    if (action === 'open') {
                        const img = root.querySelector('img');

                        return img && img.click();
                    }

                    const stepper = this.nativeStepper(root);
                    const add = this.visibleAddButton(root);

                    if (action === 'plus') {
                        if (stepper && stepper.plus) {
                            return stepper.plus.click();
                        }

                        if (add) {
                            return add.click();
                        }
                    }

                    if (action === 'minus' && stepper && stepper.minus) {
                        return stepper.minus.click();
                    }

                    this.textIndex = null;

                    const data = this.readCard(root, this.__testName);
                    const active = data.portions.length > 1 ? (data.portions.find((portion) => portion.active) || {}).label : '';
                    const drawerRow = this.drawerRows(data.name, active)[0];

                    if (!drawerRow) {
                        return action === 'plus' && add ? add.click() : null;
                    }

                    const target = this.drawerStepper(drawerRow)[action];

                    return target && target.click();
                },

                cardHTML(tn, data) {
                    const tags = data.tags.map((tag) => `<li class="${tn}_tag">${this.escapeHTML(tag)}</li>`).join('');
                    const badges = data.badges.map((badge) => {
                        const label = badge.type === 'premium' ? `★ ${badge.label}` : badge.label;

                        return `<span class="${tn}_badge ${tn}_badge--${badge.type}">${label}</span>`;
                    }).join('');
                    const nutrition = [
                        data.protein && `${data.protein} protein`,
                        data.cal && `${data.cal} cal`,
                        data.carb && `${data.carb} carbs`,
                        data.fat && `${data.fat} fat`
                    ].filter(Boolean).join(' · ');

                    const name = this.escapeHTML(data.name);
                    const plus = `<button type="button" class="${tn}_round" data-action="plus" aria-label="Add one ${name}">${this.icon('plus')}</button>`;
                    const minus = `<button type="button" class="${tn}_round ${tn}_round--dark" data-action="minus" aria-label="Remove one ${name}">${this.icon('minus')}</button>`;
                    const qty = `<span class="${tn}_qty" aria-live="polite">${data.qty}</span>`;

                    const portions = data.portions.length > 1 ? `
                <div class="${tn}_portion" role="group" aria-label="Portion size">
                    ${data.portions.map((portion) => `<button type="button" data-action="portion" data-value="${this.escapeHTML(portion.label)}" aria-pressed="${portion.active}">${this.escapeHTML(portion.label)}</button>`).join('')}
                </div>
            ` : '';

            const actions = `
                <div class="${tn}_actions">
                    ${portions}
                    ${data.qty > 0 ? `<div class="${tn}_hstep">${minus}${qty}${plus}</div>` : plus}
                </div>
            `;

            const side = `
                <div class="${tn}_side">
                    ${data.qty > 0 ? `<div class="${tn}_vstep">${plus}${qty}${minus}</div>` : plus}
                </div>
            `;

            return `
                <button type="button" class="${tn}_media" data-action="open" aria-label="${name} details">
                    ${data.image ? `<img src="${this.escapeHTML(data.image)}" alt="${this.escapeHTML(data.alt)}" loading="lazy" decoding="async" />` : ''}
                </button>
                <div class="${tn}_body">
                    ${tags ? `<ul class="${tn}_tags" data-action="open">${tags}</ul>` : ''}
                    <div class="${tn}_info" data-action="open">
                        <h3 class="${tn}_name">${name}</h3>
                        ${badges ? `<div class="${tn}_badges">${badges}</div>` : ''}
                        ${nutrition ? `<p class="${tn}_nutri">${nutrition}</p>` : ''}
                        ${data.price ? `<p class="${tn}_price">${data.comparePrice ? `<s>${this.escapeHTML(data.comparePrice)}</s> ` : ''}${this.escapeHTML(data.price)}</p>` : ''}
                    </div>
                    ${actions}
                </div>
                ${side}
            `;
        },

        renderCard(tn, root) {
            const data = this.readCard(root, tn);

            if (!this.isReady(data, root)) {
                this.retryLater(tn);
                return;
            }

            const signature = JSON.stringify(data);
            let view = root.querySelector(`:scope > .${tn}_card`);

            if (!root.classList.contains(`${tn}_native`)) {
                root.classList.add(`${tn}_native`);
            }

            if (!view) {
                view = document.createElement('div');
                view.className = `${tn}_card`;
                view.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-action]');

                    if (!button) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    this.nativeAction(root, button.getAttribute('data-action'), button.getAttribute('data-value'));
                    [60, 250, 700].forEach((delay) => setTimeout(() => this.scheduleRender(this.__testName), delay));
                });
                root.appendChild(view);
            }

            if (view.getAttribute('data-signature') === signature) {
                return;
            }

            const scroller = view.querySelector(`.${tn}_tags`);
            const scrollLeft = scroller ? scroller.scrollLeft : 0;

            view.setAttribute('data-signature', signature);
            view.classList.toggle(`${tn}_card--selected`, data.qty > 0);
            view.innerHTML = this.cardHTML(tn, data);

            const newScroller = view.querySelector(`.${tn}_tags`);

            if (newScroller) {
                newScroller.scrollLeft = scrollLeft;
            }
        },

        markGrids(tn, roots) {
            const own = `.${tn}_card`;
            const isCell = (element) => roots.some((root) => element === root || element.contains(root)) ||
                Array.from(element.querySelectorAll('img')).some((img) => !img.closest(own));

            roots.forEach((root) => {
                let grid = root.parentElement;

                while (grid && grid !== document.body && grid.children.length < 2) {
                    grid = grid.parentElement;
                }

                if (
                    grid && grid !== document.body &&
                    Array.from(grid.children).every(isCell) &&
                    !grid.classList.contains(`${tn}_grid`)
                ) {
                    grid.classList.add(`${tn}_grid`);
                }
            });
        },

        mealCount(element) {
            const match = this.text(element).match(this.vars.mealCountPattern);

            return match ? parseInt(match[1], 10) || 0 : 0;
        },

        findCartHeaders(tn) {
            const own = `.${tn}_card, .${tn}_progress, .${tn}_was`;
            const all = Array.from(document.querySelectorAll('body *')).filter((element) => {
                return !element.closest(own) && !/^(SCRIPT|STYLE|SVG|PATH)$/i.test(element.tagName);
            });
            const innermost = (list) => list.filter((element) => !list.some((other) => other !== element && element.contains(other)));
            const counts = innermost(all.filter((element) => this.vars.cartCountPattern.test(this.text(element))));
            const headers = [];

            counts.forEach((count) => {
                let row = count.parentElement;

                for (let i = 0; row && row !== document.body && i < 6; i += 1) {
                    const price = innermost(Array.from(row.querySelectorAll('*')).filter((element) => {
                        return !element.closest(own) && /^\$[\d,.]+$/.test(this.text(element));
                    }))[0];

                    if (price) {
                        if (!headers.some((item) => item.row === row)) {
                            headers.push({ row, count, price });
                        }
                        break;
                    }

                    row = row.parentElement;
                }
            });

            return headers;
        },

        cartState() {
            const body = Array.from(document.body.children).filter((element) => {
                return !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(element.tagName);
            }).map((element) => element.textContent).join(' ').replace(/\s+/g, ' ');
            const amounts = (label) => {
                const match = body.match(new RegExp(`\\b${label}\\s*((?:[-−]?\\s*\\$\\s*[\\d,]+(?:\\.\\d+)?\\s*)+)`, 'i'));

                return match ? (match[1].match(/[\d,]+(?:\.\d+)?/g) || []).map((value) => parseFloat(value.replace(/,/g, ''))) : [];
            };
            const ppm = amounts('price per meal');
            const total = amounts('total');
            const save = body.match(/add\s+(\d+)\s+more\s+meals?\s+to\s+save\s+\$([\d.]+)/i);
            const atLeast = body.match(/add at least\s+(\d+)\s+more\s+meals?/i);

            return {
                pricePerMeal: ppm.length ? Math.min.apply(null, ppm) : null,
                basePricePerMeal: ppm.length > 1 ? Math.max.apply(null, ppm) : null,
                totalOriginal: total.length > 1 ? Math.max.apply(null, total) : null,
                totalDiscounted: total.length > 1 ? Math.min.apply(null, total) : null,
                saving: save ? parseFloat(save[2]) : null,
                atLeast: atLeast ? parseInt(atLeast[1], 10) : null
            };
        },

        money(value) {
            return `$${(Math.round(value * 100) / 100).toFixed(2)}`;
        },

        levelOf(count) {
            return this.vars.tiers.filter((tier) => count >= tier).length;
        },

        prices(count) {
            const key = `${this.__testName}_prices_v2`;

            if (!this.priceCache) {
                try {
                    this.priceCache = JSON.parse(sessionStorage.getItem(key)) || {};
                } catch (error) {
                    this.priceCache = {};
                }
            }

            const state = this.cartState();
            const level = this.levelOf(count);

            if (state.basePricePerMeal) {
                this.priceCache[0] = state.basePricePerMeal;
            }

            if (count > 0 && state.pricePerMeal) {
                this.priceCache[level] = state.pricePerMeal;

                if (state.saving && level < this.vars.tiers.length) {
                    this.priceCache[level + 1] = Math.round((state.pricePerMeal - state.saving) * 100) / 100;
                }
            }

            try {
                sessionStorage.setItem(key, JSON.stringify(this.priceCache));
            } catch (error) {
            }

            return this.vars.fallbackPrices.map((fallback, index) => {
                return typeof this.priceCache[index] === 'number' ? this.priceCache[index] : fallback;
            });
        },

        progressState(count) {
            const tiers = this.vars.tiers;
            const top = tiers[tiers.length - 1];
            const state = this.cartState();
            const prices = this.prices(count);
            const level = this.levelOf(count);
            const current = prices[level];
            const saving = state.totalOriginal !== null && state.totalDiscounted !== null ?
                Math.max(0, state.totalOriginal - state.totalDiscounted) :
                Math.max(0, (prices[0] - current) * count);
            const next = tiers.find((tier) => tier > count);
            const plural = (n) => `${n} more meal${n > 1 ? 's' : ''}`;
            const isBest = (tier) => tier === top;

            const previous = typeof this.lastCount === 'number' ? this.lastCount : count;

            // Downgrade message (spec 9): ONLY when the shopper removes a meal while sitting
            // on a tier (10, 15 or 20), so the cart lands one below it (9, 14 or 19).
            // - shown at 9 after 10 → 9 (also 14 after 15 → 14, 19 after 20 → 19)
            // - never shown when the cart was below the tier and a meal is removed
            //   (e.g. 9 → 8, 8 → 7, 12 → 11): those keep the normal message
            // - cleared on the next change (adding the meal back, or removing another one)
            if (count !== previous) {
                const lost = tiers.find((tier) => previous === tier && count === tier - 1);

                this.dropped = lost || null;
            }

            this.lastCount = count;

            if (this.dropped && count !== this.dropped - 1) {
                this.dropped = null;
            }

            if (this.dropped && count > 0) {
                const missing = this.dropped - count;

                return {
                    tone: 'warning',
                    percent: Math.round((count / this.dropped) * 100),
                    saving,
                    lines: [`Back to ${this.money(current)}/meal. Add ${missing} meal${missing > 1 ? 's' : ''} to get ${this.money(prices[this.levelOf(this.dropped)])} back`]
                };
            }

            const minimumMissing = Math.max(state.atLeast || 0, this.vars.minimum - count, 0);

            if (minimumMissing > 0) {
                const goal = count + minimumMissing;

                return {
                    tone: 'default',
                    percent: Math.round((count / goal) * 100),
                    saving: 0,
                    lines: [`Add ${plural(minimumMissing)} to complete your box`]
                };
            }

            if (!next) {
                return {
                    tone: 'default',
                    percent: 100,
                    saving,
                    lines: [`<strong class="${this.__testName}_ok">${this.check()} Best price unlocked: ${this.money(current)}/meal. You save ${this.money(saving)}</strong>`]
                };
            }

            const missing = next - count;
            const nextPrice = prices[level + 1];
            const unlockTarget = isBest(next) ? `our best price, ${this.money(nextPrice)}/meal` : `${this.money(nextPrice)}/meal`;
            const percent = Math.round((count / next) * 100);

            if (missing === 1) {
                return {
                    tone: 'default',
                    percent,
                    saving,
                    lines: [`<strong class="${this.__testName}_hl">1 more meal unlocks ${unlockTarget}</strong>`]
                };
            }

            const nextStep = isBest(next) ?
                `Add ${missing} more for our best price, ${this.money(nextPrice)}/meal` :
                `Add ${missing} more to unlock ${this.money(nextPrice)}/meal`;

            if (tiers.indexOf(count) !== -1) {
                return {
                    tone: 'default',
                    percent,
                    saving,
                    lines: [
                        `<strong class="${this.__testName}_ok">${this.check()} ${this.money(current)}/meal unlocked. You save ${this.money(saving)}</strong>`,
                        nextStep
                    ]
                };
            }

            if (level > 0) {
                return {
                    tone: 'default',
                    percent,
                    saving,
                    lines: [`Saving ${this.money(saving)}. ${nextStep}`]
                };
            }

            return {
                tone: 'default',
                percent,
                saving: 0,
                lines: [`Add ${plural(missing)} to unlock ${this.money(nextPrice)}/meal`]
            };
        },

        check() {
            return '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        },

        progressHTML(tn, count) {
            const progress = this.progressState(count);

            return {
                saving: progress.saving,
                html: `
                    <div class="${tn}_bar ${tn}_bar--${progress.tone}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(progress.percent, 100)}"><span style="--p:${Math.min(progress.percent, 100)}%"></span></div>
                    ${progress.lines.map((line) => `<p class="${tn}_copy ${tn}_copy--${progress.tone}">${line}</p>`).join('')}
                `
            };
        },

        renderCart(tn) {
            const headers = this.findCartHeaders(tn);
            const count = headers.length ? this.mealCount(headers[0].count) : 0;
            const progress = headers.length ? this.progressHTML(tn, count) : null;

            const used = [];

            const rows = headers.map((header) => header.row);
            const unique = headers.filter((header) => !rows.some((other) => other !== header.row && other.contains(header.row)));

            unique.forEach(({ row, count: countElement, price }) => {
                const parent = row.parentElement;

                if (!parent) {
                    return;
                }

                let block = row.nextElementSibling && row.nextElementSibling.classList.contains(`${tn}_progress`) ?
                    row.nextElementSibling :
                    parent.querySelector(`:scope > .${tn}_progress`);

                [[countElement, 'count'], [price, 'total'], [parent, 'headbg'], [row, 'headbg']].forEach(([element, name]) => {
                    if (element && !element.classList.contains(`${tn}_${name}`)) {
                        element.classList.add(`${tn}_${name}`);
                    }
                });

                if (parent && /flex/.test(getComputedStyle(parent).display) && getComputedStyle(parent).flexDirection.indexOf('row') === 0 &&
                    !parent.classList.contains(`${tn}_headwrap`)) {
                    parent.classList.add(`${tn}_headwrap`);
                }

                const total = parseFloat(this.text(price).replace(/[^\d.]/g, '')) || 0;
                let was = price.previousElementSibling && price.previousElementSibling.classList.contains(`${tn}_was`) ? price.previousElementSibling : null;
                const wasText = progress.saving > 0.004 ? this.money(total + progress.saving) : '';

                if (wasText) {
                    if (!was) {
                        was = document.createElement('s');
                        was.className = `${tn}_was`;
                        price.insertAdjacentElement('beforebegin', was);
                    }

                    if (was.textContent !== wasText) {
                        was.textContent = wasText;
                    }
                } else if (was) {
                    was.remove();
                }

                if (used.indexOf(block) !== -1) {
                    block = null;
                }

                if (!block) {
                    block = document.createElement('div');
                    block.className = `${tn}_progress`;
                }

                if (row.nextElementSibling !== block) {
                    row.insertAdjacentElement('afterend', block);
                }

                used.push(block);

                if (block.getAttribute('data-html') !== progress.html) {
                    block.setAttribute('data-html', progress.html);
                    block.innerHTML = progress.html;
                }
            });

            document.querySelectorAll(`.${tn}_progress`).forEach((block) => {
                if (used.indexOf(block) === -1) {
                    block.remove();
                }
            });

            document.querySelectorAll(`.${tn}_was`).forEach((was) => {
                const next = was.nextElementSibling;

                if (!next || !next.classList.contains(`${tn}_total`) || !unique.some((header) => header.price === next)) {
                    was.remove();
                }
            });

            ['count', 'total'].forEach((name) => {
                document.querySelectorAll(`.${tn}_${name}`).forEach((element) => {
                    const key = name === 'count' ? 'count' : 'price';

                    if (!unique.some((header) => header[key] === element)) {
                        element.classList.remove(`${tn}_${name}`);
                    }
                });
            });
        },

        // Writes the cart header height to the CSS variable through a style rule on the
        // target selector, so it only applies while the selector matches (not while
        // .openMobileCart is on the cart).
        updateHeaderHeight(tn) {
            const settings = this.vars.headerHeight;
            const header = document.querySelector(settings.header);

            // follow size changes of the header (progress text changes, wrapping, resize)
            if (header !== this.headerObserved) {
                if (this.headerResize) {
                    this.headerResize.disconnect();
                }

                this.headerObserved = header;

                if (header && window.ResizeObserver) {
                    this.headerResize = new ResizeObserver(() => this.updateHeaderHeight(tn));
                    this.headerResize.observe(header);
                }
            }

            if (!header) {
                return;
            }

            const height = Math.round(header.getBoundingClientRect().height);

            // 0 = header hidden right now: keep the last real height
            if (!height || height === this.headerHeightValue) {
                return;
            }

            this.headerHeightValue = height;

            let style = document.getElementById(`${tn}_header_height`);

            if (!style) {
                style = document.createElement('style');
                style.id = `${tn}_header_height`;
                document.head.appendChild(style);
            }

            style.textContent = `${settings.target} { ${settings.variable}: ${height}px; }`;
        },

        cleanUp(tn) {
            const heightStyle = document.getElementById(`${tn}_header_height`);

            if (heightStyle) {
                heightStyle.remove();
            }

            if (this.headerResize) {
                this.headerResize.disconnect();
                this.headerResize = null;
            }

            this.headerObserved = null;
            this.headerHeightValue = null;

            document.querySelectorAll(`.${tn}_card, .${tn}_progress, .${tn}_was`).forEach((element) => element.remove());
            ['native', 'grid', 'headbg', 'headwrap', 'count', 'total'].forEach((name) => {
                document.querySelectorAll(`.${tn}_${name}`).forEach((element) => element.classList.remove(`${tn}_${name}`));
            });
        },

        retryLater(tn) {
            if (this.retryTimer) {
                return;
            }

            this.retries = (this.retries || 0) + 1;

            if (this.retries > 20) {
                return; // ~10s of retries; later changes are still caught by the observer
            }

            this.retryTimer = setTimeout(() => {
                this.retryTimer = null;
                this.scheduleRender(tn);
            }, 500);
        },

        waitForProducts(tn) {
            return new Promise((resolve) => {
                const started = Date.now();
                let last = -1;
                let stable = 0;

                const check = () => {
                    const count = this.findCards(tn).length;

                    stable = count > 0 && count === last ? stable + 1 : 0;
                    last = count;

                    if (stable >= 4 || Date.now() - started > 5000) {
                        resolve();
                        return;
                    }

                    setTimeout(check, 250);
                };

                check();
            });
        },

        render(tn) {
            if (!this.vars.pathPattern.test(window.location.pathname)) {
                this.cleanUp(tn);
                this.productsReady = false;
                return;
            }

            if (!this.productsReady) {
                return;
            }

            this.textIndex = null;

            const roots = this.findCards(tn);

            roots.forEach((root) => this.renderCard(tn, root));
            this.markGrids(tn, roots);
            this.renderCart(tn);
            this.updateHeaderHeight(tn);
        },

        scheduleRender(tn) {
            if (this.scheduled) {
                return;
            }

            const now = Date.now();

            this.renderTimes = (this.renderTimes || []).filter((time) => now - time < 1000);

            if (this.renderTimes.length >= 40) {
                this.scheduled = true;
                setTimeout(() => {
                    this.scheduled = false;
                    this.renderTimes = [];
                    this.render(tn);
                }, 250);
                return;
            }

            this.renderTimes.push(now);
            this.scheduled = true;

            window.requestAnimationFrame(() => {
                this.scheduled = false;
                this.render(tn);
            });
        },

        exposeDebug(tn) {
            window[`${tn}_debug`] = () => {
                this.textIndex = null;
                const rows = this.findCards(tn).map((root) => {
                    const data = this.readCard(root, tn);
                    const input = Array.from(root.querySelectorAll('input')).filter((element) => !element.closest(`.${tn}_card`));
                    const stepper = this.nativeStepper(root);
                    const active = data.portions.length > 1 ? (data.portions.find((portion) => portion.active) || {}).label : '';

                    return {
                        name: data.name,
                        portion: active || '-',
                        qty: data.qty,
                        addVisible: Boolean(this.visibleAddButton(root)),
                        stepperQty: stepper ? stepper.qty : '-',
                        inputs: input.map((element) => `${element.type}=${element.value}`).join(', '),
                        drawerQty: this.drawerQty(data.name, active),
                        buttons: this.stepButtons(root).map((button) => `${this.text(button) || button.getAttribute('aria-label') || '[icon]'}(${this.stepDirection(button) || '?'})`).join(' | ')
                    };
                });
                const headers = this.findCartHeaders(tn);

                console.table(rows);
                console.log('cart headers:', headers);
                console.log('meal count:', headers.length ? this.mealCount(headers[0].count) : 'no header found');

                return rows;
            };
        },

        loadWidget: function() {
            const tn = this.__testName;

            this.exposeDebug(tn);

            this.runAt('main img, #__next img', () => {
                if (!this.vars.pathPattern.test(window.location.pathname)) {
                    this.render(tn); // clean up when not on the meals page
                    return;
                }

                this.productsReady = false;
                this.retries = 0;
                this.waitForProducts(tn).then(() => {
                    this.productsReady = true;
                    this.render(tn);
                });

                if (!this.imageListener) {
                    this.imageListener = (event) => {
                        if (event.target && event.target.tagName === 'IMG' && !event.target.closest(`.${tn}_card`)) {
                            this.retries = 0;
                            this.scheduleRender(tn);
                        }
                    };
                    document.addEventListener('load', this.imageListener, true);
                }

                if (!this.resizeListener) {
                    this.resizeListener = () => this.updateHeaderHeight(tn);
                    window.addEventListener('resize', this.resizeListener);
                }

                if (!this.observer) {
                    this.observer = new MutationObserver((mutations) => {
                        const own = `.${tn}_card, .${tn}_progress, .${tn}_was`;
                        const isOwn = (node) => node.nodeType === 1 && (node.matches(own) || Boolean(node.closest(own)));
                        const relevant = mutations.some((mutation) => {
                            const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;

                            if (!target || target.closest(own)) {
                                return false;
                            }

                            if (mutation.type === 'childList') {
                                const nodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));

                                return nodes.some((node) => !isOwn(node));
                            }

                            return true;
                        });

                        if (relevant) {
                            this.scheduleRender(tn);
                        }
                    });

                    this.observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                        attributes: true,
                        attributeFilter: ['aria-pressed', 'aria-checked', 'aria-selected', 'data-state', 'src', 'srcset', 'data-src', 'data-srcset']
                    });
                }
            });
        },

        init() {
            let self = this;
            self.loadWidget();
            (function () {
                let lastUrl = document.URL;

                function checkUrlChange() {
                    const currentUrl = document.URL;
                    if (currentUrl !== lastUrl) {
                        lastUrl = currentUrl;
                        self.loadWidget();
                    }
                }

                setInterval(checkUrlChange, 200);

                window.addEventListener('popstate', checkUrlChange);
                window.addEventListener('hashchange', checkUrlChange);
            })();
        }
    }
});
