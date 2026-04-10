/**
 * SAR Bundle — storefront step builder (vanilla JS).
 * Fetches config via App Proxy: GET /apps/sar-bundle/api/bundle/:ref
 */
(function () {
  'use strict';

  var PROXY_PATH = '/apps/sar-bundle/api/bundle';

  function shopifyRoot() {
    if (
      typeof window.Shopify !== 'undefined' &&
      window.Shopify.routes &&
      window.Shopify.routes.root
    ) {
      return window.Shopify.routes.root;
    }
    return '/';
  }

  function joinRoot(path) {
    var r = shopifyRoot();
    if (r.endsWith('/')) return r + path.replace(/^\//, '');
    return r + '/' + path.replace(/^\//, '');
  }

  function variantGidToNumericId(gid) {
    var m = String(gid).match(/ProductVariant\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseMoney(priceStr) {
    return parseFloat(String(priceStr).replace(',', '.')) || 0;
  }

  /** Affichage prix (API Admin ou Ajax) avec devise */
  function formatMoneyDisplay(amountStr, currencyCode) {
    if (amountStr == null || amountStr === '') return '—';
    var n = parseFloat(String(amountStr).replace(',', '.'));
    if (Number.isNaN(n)) return String(amountStr);
    var cur = currencyCode || 'EUR';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: cur,
      }).format(n);
    } catch (e) {
      return String(amountStr) + ' ' + cur;
    }
  }

  /**
   * Données enrichies côté serveur (Admin API) : titres, image, prix réels.
   * Surcharge le cache variant après les appels /variants/:id.js.
   */
  function applyStorefrontEnrichment(bundle, priceMap, variantCache) {
    if (!bundle.steps) return;
    for (var si = 0; si < bundle.steps.length; si++) {
      var prods = bundle.steps[si].products || [];
      for (var pi = 0; pi < prods.length; pi++) {
        var row = prods[pi];
        var sf = row.storefront;
        if (!sf) continue;
        var gid = row.variantGid;
        if (sf.priceAmount != null && sf.priceAmount !== '') {
          var pa = parseFloat(String(sf.priceAmount).replace(',', '.'));
          if (!Number.isNaN(pa)) priceMap[gid] = pa;
        }
        var imgSrc = sf.imageUrl || null;
        variantCache[gid] = {
          title: sf.displayTitle,
          featured_image: imgSrc ? { src: imgSrc } : null,
          price: sf.priceAmount != null ? String(sf.priceAmount) : '0',
          currencyCode: sf.currencyCode,
        };
      }
    }
  }

  function buildProductRowByVariantGid(bundle) {
    var map = {};
    if (!bundle.steps) return map;
    for (var si = 0; si < bundle.steps.length; si++) {
      var prods = bundle.steps[si].products || [];
      for (var pi = 0; pi < prods.length; pi++) {
        var row = prods[pi];
        if (row.variantGid) map[row.variantGid] = row;
      }
    }
    return map;
  }

  /**
   * Une entrée pour la propriété JSON _sar_bundle_components (ligne unique = produit bundle).
   */
  function componentEntryForSelection(
    originalGid,
    effectiveGid,
    qty,
    prodRow,
    variantCache,
    productJsonByHandle,
  ) {
    var sf = prodRow && prodRow.storefront;
    var ph =
      (prodRow &&
        (prodRow.productHandle ||
          (prodRow.storefront && prodRow.storefront.productHandle))) ||
      '';
    var m = variantCache[effectiveGid] || {};
    var image = '';
    if (effectiveGid !== originalGid) {
      if (m.featured_image && m.featured_image.src) {
        image = String(m.featured_image.src);
      } else if (typeof m.featured_image === 'string') {
        image = m.featured_image;
      }
    }
    if (!image && sf && sf.imageUrl) image = String(sf.imageUrl);
    if (!image && m.featured_image) {
      if (m.featured_image.src) image = String(m.featured_image.src);
      else if (typeof m.featured_image === 'string') image = m.featured_image;
    }

    var productTitle = '';
    var variantTitle = '';

    if (sf) {
      productTitle = String(sf.productTitle || sf.displayTitle || '');
      var vtt =
        effectiveGid !== originalGid && m.title
          ? String(m.title).trim()
          : sf.variantTitle && String(sf.variantTitle).trim();
      if (
        vtt &&
        vtt.toLowerCase() !== 'default title' &&
        vtt !== 'Default'
      ) {
        variantTitle = vtt;
      }
    } else {
      if (ph && productJsonByHandle[ph] && productJsonByHandle[ph].title) {
        productTitle = String(productJsonByHandle[ph].title);
        var vt = m.title;
        if (vt && vt !== 'Default Title' && vt !== 'Default') {
          variantTitle = String(vt);
        }
      } else {
        var nm = m.name && String(m.name);
        if (nm) {
          productTitle = nm;
        } else if (m.title) {
          productTitle = String(m.title);
        } else {
          productTitle = String(originalGid.split('/').pop());
        }
        if (
          m.title &&
          m.title !== 'Default Title' &&
          m.title !== 'Default' &&
          (!nm || productTitle !== nm)
        ) {
          variantTitle = String(m.title);
        }
      }
    }

    var vid = variantGidToNumericId(effectiveGid);
    return {
      variantGid: String(effectiveGid),
      variantId: vid,
      productTitle: productTitle.slice(0, 200),
      variantTitle: variantTitle ? variantTitle.slice(0, 120) : '',
      imageUrl: image ? image.slice(0, 500) : '',
      quantity: qty,
    };
  }

  function buildBundleComponentsPayload(
    bundle,
    selections,
    variantChoice,
    variantCache,
    productJsonByHandle,
  ) {
    var rowMap = buildProductRowByVariantGid(bundle);
    var rows = [];
    for (var gk in selections) {
      if (!Object.prototype.hasOwnProperty.call(selections, gk)) continue;
      var q = selections[gk] || 0;
      if (q <= 0) continue;
      var eg = variantChoice[gk] || gk;
      var prodRow = rowMap[gk];
      rows.push(
        componentEntryForSelection(
          gk,
          eg,
          q,
          prodRow,
          variantCache,
          productJsonByHandle,
        ),
      );
    }
    return rows;
  }

  /** Limite propriété ligne Shopify (~8k côté pratique). */
  function serializeBundleComponentsProperty(components) {
    var max = 7500;
    function stringify(arr) {
      return JSON.stringify(arr);
    }
    var s = stringify(components);
    if (s.length <= max) return s;
    var trimmed = components.map(function (c) {
      return Object.assign({}, c, { imageUrl: '' });
    });
    s = stringify(trimmed);
    if (s.length <= max) return s;
    while (trimmed.length > 1 && stringify(trimmed).length > max) {
      trimmed.pop();
    }
    s = stringify(trimmed);
    if (s.length > max) {
      trimmed = trimmed.map(function (c) {
        return {
          variantId: c.variantId,
          quantity: c.quantity,
          productTitle: String(c.productTitle || '').slice(0, 60),
          variantTitle: String(c.variantTitle || '').slice(0, 40),
        };
      });
      s = stringify(trimmed);
    }
    return s.length <= max ? s : s.slice(0, max);
  }

  function getTotals(selections, priceMap, variantChoice) {
    var bundlePrice = 0;
    var totalQty = 0;
    var distinct = {};
    var gid;
    variantChoice = variantChoice || {};
    for (gid in selections) {
      if (!Object.prototype.hasOwnProperty.call(selections, gid)) continue;
      var q = selections[gid] || 0;
      if (q <= 0) continue;
      totalQty += q;
      distinct[gid] = true;
      var eg = variantChoice[gid] || gid;
      var unit = priceMap[eg] || 0;
      bundlePrice += unit * q;
    }
    var distinctCount = 0;
    for (gid in distinct) {
      if (Object.prototype.hasOwnProperty.call(distinct, gid)) distinctCount++;
    }
    return {
      bundlePrice: bundlePrice,
      totalItemCount: totalQty,
      distinctVariantCount: distinctCount,
    };
  }

  function variantQty(selections, targetGid) {
    return selections[targetGid] || 0;
  }

  function evalRule(rule, ctx) {
    var left = 0;
    switch (rule.metric) {
      case 'BUNDLE_PRICE':
        left = ctx.bundlePrice;
        break;
      case 'TOTAL_ITEM_COUNT':
        left = ctx.totalItemCount;
        break;
      case 'DISTINCT_VARIANT_COUNT':
        left = ctx.distinctVariantCount;
        break;
      case 'VARIANT_QUANTITY':
        left = variantQty(ctx.selections, rule.targetVariantGid);
        break;
      default:
        return true;
    }
    var right = parseFloat(rule.value);
    if (Number.isNaN(right)) return false;
    switch (rule.operator) {
      case 'LT':
        return left < right;
      case 'LTE':
        return left <= right;
      case 'EQ':
        return Math.abs(left - right) < 1e-6;
      case 'GTE':
        return left >= right;
      case 'GT':
        return left > right;
      default:
        return true;
    }
  }

  function validateStepRules(bundle, stepIndex, selections, priceMap, variantChoice) {
    var step = bundle.steps[stepIndex];
    if (!step || !step.rules || !step.rules.length)
      return { ok: true, messages: [] };
    var base = getTotals(selections, priceMap, variantChoice);
    var ctx = {
      bundlePrice: base.bundlePrice,
      totalItemCount: base.totalItemCount,
      distinctVariantCount: base.distinctVariantCount,
      selections: selections,
    };
    var messages = [];
    for (var i = 0; i < step.rules.length; i++) {
      var rule = step.rules[i];
      if (!evalRule(rule, ctx)) {
        messages.push(
          'Condition non remplie (' +
            rule.metric +
            ' ' +
            rule.operator +
            ' ' +
            rule.value +
            ').',
        );
      }
    }
    return { ok: messages.length === 0, messages: messages };
  }

  /** Valide les règles de toutes les étapes avant paiement (ligne bundle unique). */
  function validateAllStepsForCheckout(
    bundle,
    selections,
    priceMap,
    variantChoice,
  ) {
    var steps = bundle.steps || [];
    var messages = [];
    for (var si = 0; si < steps.length; si++) {
      var v = validateStepRules(
        bundle,
        si,
        selections,
        priceMap,
        variantChoice,
      );
      if (!v.ok) {
        for (var mi = 0; mi < v.messages.length; mi++) {
          messages.push(v.messages[mi]);
        }
      }
    }
    return { ok: messages.length === 0, messages: messages };
  }

  /**
   * Si une règle TOTAL_ITEM_COUNT + EQ existe (étape finale en priorité),
   * le total d’articles sélectionnés doit être exactement cette valeur.
   */
  function getRequiredExactTotalItemCount(bundle) {
    var steps = bundle.steps || [];
    var finalIdx = -1;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].isFinalStep) {
        finalIdx = i;
        break;
      }
    }
    function findEq(step) {
      if (!step || !step.rules) return null;
      for (var ri = 0; ri < step.rules.length; ri++) {
        var r = step.rules[ri];
        if (
          r.metric === 'TOTAL_ITEM_COUNT' &&
          r.operator === 'EQ' &&
          r.value != null
        ) {
          var n = parseFloat(String(r.value));
          if (!Number.isNaN(n)) return n;
        }
      }
      return null;
    }
    if (finalIdx >= 0) {
      var onFinal = findEq(steps[finalIdx]);
      if (onFinal != null) return onFinal;
    }
    for (var s = 0; s < steps.length; s++) {
      var v = findEq(steps[s]);
      if (v != null) return v;
    }
    return null;
  }

  /** Rétrocompat si `bundlePricingMode` absent (anciens bundles). */
  function resolveBundlePricingMode(bundle) {
    var m = bundle.bundlePricingMode;
    if (m === 'STANDARD' || m === 'FIXED_PRICE_BOX' || m === 'TIERED') return m;
    if (bundle.pricingScope === 'TIERED') return 'TIERED';
    if (bundle.discountValueType === 'FIXED_PRICE') return 'FIXED_PRICE_BOX';
    return 'STANDARD';
  }

  function parseBundleDecimal(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  function pickPrimaryCurrency(bundle, variantCache) {
    var steps = bundle.steps || [];
    for (var si = 0; si < steps.length; si++) {
      var prods = steps[si].products || [];
      for (var pi = 0; pi < prods.length; pi++) {
        var row = prods[pi];
        var sf = row.storefront;
        if (sf && sf.currencyCode) return String(sf.currencyCode);
        var gid = row.variantGid;
        var m = variantCache[gid];
        if (m && m.currencyCode) return String(m.currencyCode);
      }
    }
    return 'EUR';
  }

  function findMatchingTier(bundle, totals) {
    var tiers = bundle.pricingTiers || [];
    var sorted = tiers.slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    for (var i = 0; i < sorted.length; i++) {
      var t = sorted[i];
      var val =
        t.thresholdBasis === 'CART_VALUE'
          ? totals.bundlePrice
          : totals.totalItemCount;
      var min = parseFloat(String(t.thresholdMin).replace(',', '.'));
      var maxRaw = t.thresholdMax;
      var max =
        maxRaw == null || maxRaw === ''
          ? Infinity
          : parseFloat(String(maxRaw).replace(',', '.'));
      if (Number.isNaN(min)) min = 0;
      if (Number.isNaN(max)) max = Infinity;
      if (val >= min && val <= max) return t;
    }
    return null;
  }

  /** discountValueType admin : PERCENT | FIXED_AMOUNT | FIXED_PRICE (prix cible pour le total). */
  function applyDiscountToBase(base, type, rawVal) {
    var v = parseBundleDecimal(rawVal);
    if (v == null) return base;
    if (type === 'PERCENT') return Math.max(0, base * (1 - v / 100));
    if (type === 'FIXED_AMOUNT') return Math.max(0, base - v);
    if (type === 'FIXED_PRICE') return Math.max(0, v);
    return base;
  }

  /**
   * Prix total bundle affiché (cohérent avec les modes admin).
   * compareAt : somme des articles (pour prix barré) si activé.
   */
  function getDisplayedBundlePrice(bundle, totals) {
    var mode = resolveBundlePricingMode(bundle);
    var base = totals.bundlePrice;
    var showCompare = !!bundle.showCompareAtPrice;
    if (mode === 'FIXED_PRICE_BOX') {
      var fixed = parseBundleDecimal(bundle.flatDiscountValue);
      var amt = fixed != null ? fixed : base;
      var cmp = showCompare && base > amt + 1e-9 ? base : null;
      return { amount: amt, compareAt: cmp };
    }
    if (mode === 'TIERED') {
      var tier = findMatchingTier(bundle, totals);
      var dt = bundle.discountValueType || 'PERCENT';
      var after = tier
        ? applyDiscountToBase(base, dt, tier.tierValue)
        : base;
      var cmpTier =
        showCompare && tier && after < base - 1e-9 ? base : null;
      return { amount: after, compareAt: cmpTier };
    }
    var flat = bundle.flatDiscountValue;
    if (flat == null || String(flat).trim() === '') {
      return { amount: base, compareAt: null };
    }
    var st = bundle.discountValueType || 'PERCENT';
    var afterStd = applyDiscountToBase(base, st, flat);
    var cmpStd =
      showCompare && afterStd < base - 1e-9 ? base : null;
    return { amount: afterStd, compareAt: cmpStd };
  }

  /**
   * Nombre exact d’articles requis : `fixedBoxItemCount` (prix fixe) ou règle TOTAL_ITEM_COUNT EQ.
   */
  function requiredExactItemCountForBundle(bundle) {
    var mode = resolveBundlePricingMode(bundle);
    if (mode === 'FIXED_PRICE_BOX' && bundle.fixedBoxItemCount != null) {
      var n = parseInt(String(bundle.fixedBoxItemCount), 10);
      if (!Number.isNaN(n) && n >= 1) return n;
    }
    return getRequiredExactTotalItemCount(bundle);
  }

  /** Propriété panier lisible (thèmes qui masquent les clés `_…`). maxLen évite les limites Shopify. */
  function formatCompositionVisibleLines(components, maxLen) {
    maxLen = maxLen || 1200;
    var lines = [];
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      var qty = c.quantity != null ? c.quantity : 1;
      var title = String(c.productTitle || '').trim();
      var vt = String(c.variantTitle || '').trim();
      var label = title;
      if (vt && vt !== 'Default Title' && vt !== 'Default') {
        label = label ? label + ' — ' + vt : vt;
      }
      if (!label) label = String(c.variantGid || 'Article');
      lines.push(String(qty) + '× ' + label);
    }
    var s = lines.join('\n');
    if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
    return s;
  }

  function fetchVariantJson(numericId) {
    return fetch(joinRoot('variants/' + numericId + '.js'), {
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      if (!res.ok) throw new Error('variant');
      return res.json();
    });
  }

  function fetchBundleConfig(ref) {
    // App Proxy lives at shop domain root: /apps/sar-bundle/... (not under locale prefix).
    var url = PROXY_PATH + '/' + encodeURIComponent(ref);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer =
      ctrl &&
      setTimeout(function () {
        try {
          ctrl.abort();
        } catch (e) {}
      }, 30000);
    return fetch(url, {
      headers: { Accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.text().then(function (text) {
          if (timer) clearTimeout(timer);
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error(
                'Réponse proxy invalide (HTML ou non-JSON). Vérifiez l’URL de l’app et l’App Proxy.',
              );
            }
          }
          if (!res.ok) {
            throw new Error(
              (data && data.error) || res.statusText || 'Erreur proxy',
            );
          }
          return data;
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === 'AbortError') {
          throw new Error('Délai dépassé en contactant le serveur du bundle.');
        }
        throw err;
      });
  }

  function collectVariantIds(bundle) {
    var ids = [];
    var seen = {};
    for (var i = 0; i < bundle.steps.length; i++) {
      var prods = bundle.steps[i].products || [];
      for (var j = 0; j < prods.length; j++) {
        var gid = prods[j].variantGid;
        var nid = variantGidToNumericId(gid);
        if (nid && !seen[gid]) {
          seen[gid] = true;
          ids.push({ gid: gid, nid: nid });
        }
      }
    }
    return ids;
  }

  function mount(el, explicitBundleData) {
    var ref = (
      el.getAttribute('data-bundle-ref') ||
      el.getAttribute('data-bundle-id') ||
      ''
    ).trim();
    var heading = el.getAttribute('data-heading') || '';
    var showProgress = el.getAttribute('data-show-progress') !== 'false';
    var loading = el.querySelector('[data-sar-loading]');
    var inner = el.querySelector('[data-sar-inner]');

    if (!loading) {
      return Promise.resolve();
    }

    if (!ref && !explicitBundleData) {
      loading.textContent = "Ajoutez l'ID du bundle dans les paramètres du bloc.";
      return Promise.resolve();
    }

    if (!inner) {
      loading.textContent = 'Structure du bloc incomplète.';
      return Promise.resolve();
    }

    var fetchPromise = explicitBundleData
      ? Promise.resolve(explicitBundleData)
      : fetchBundleConfig(ref);

    return fetchPromise
      .then(function (bundle) {
        if (!bundle || !bundle.steps) return; // Fallback
        if (!bundle.steps.length) {
          loading.textContent = "Ce bundle n'a pas d'étapes.";
          return;
        }

        var priceMap = {};
        var variantCache = {};
        var productJsonByHandle = {};
        var collectionProductsByHandle = {};
        var collectionFetchInFlight = {};
        var ids = collectVariantIds(bundle);

        return Promise.all(
          ids.map(function (entry) {
            return fetchVariantJson(entry.nid)
              .then(function (j) {
                variantCache[entry.gid] = j;
                priceMap[entry.gid] = parseMoney(j.price);
              })
              .catch(function () {
                variantCache[entry.gid] = { title: entry.gid, price: '0' };
                priceMap[entry.gid] = 0;
              });
          }),
        )
          .then(function () {
            applyStorefrontEnrichment(bundle, priceMap, variantCache);
            var handles = [];
            for (var hsi = 0; hsi < bundle.steps.length; hsi++) {
              var pr = bundle.steps[hsi].products || [];
              for (var hpx = 0; hpx < pr.length; hpx++) {
                var row = pr[hpx];
                var ph =
                  row.productHandle ||
                  (row.storefront && row.storefront.productHandle) ||
                  '';
                if (ph && handles.indexOf(ph) < 0) handles.push(ph);
              }
            }
            return Promise.all(
              handles.map(function (h) {
                return fetch(
                  joinRoot('products/' + encodeURIComponent(h) + '.js'),
                  { headers: { Accept: 'application/json' } },
                )
                  .then(function (r) {
                    return r.ok ? r.json() : null;
                  })
                  .then(function (j) {
                    if (j) productJsonByHandle[h] = j;
                  });
              }),
            );
          })
          .then(function () {
          loading.hidden = true;
          inner.hidden = false;

          var gc = bundle.storefrontDesign && bundle.storefrontDesign.global;
          if (gc) {
            if (gc.colorPrimary) el.style.setProperty('--sar-color-primary', gc.colorPrimary);
            if (gc.colorBorder) el.style.setProperty('--sar-color-border', gc.colorBorder);
            if (gc.colorBackground) el.style.setProperty('--sar-color-bg', gc.colorBackground);
            if (gc.colorText) el.style.setProperty('--sar-color-text', gc.colorText);
          }

          var state = {
            stepIndex: (explicitBundleData && explicitBundleData.stepIndex != null) ? explicitBundleData.stepIndex : 0,
            selections: {},
            selected: {},
            variantChoice: {},
            upsellSelections: {}, // item.id -> boolean
          };

          for (var si = 0; si < bundle.steps.length; si++) {
            var prods = bundle.steps[si].products || [];
            for (var pi = 0; pi < prods.length; pi++) {
              var g = prods[pi].variantGid;
              if (state.selections[g] == null) {
                state.selections[g] = 0;
                state.selected[g] = false;
              }
            }
          }

          var finalIdx = -1;
          for (var fi = 0; fi < bundle.steps.length; fi++) {
            if (bundle.steps[fi].isFinalStep) {
              finalIdx = fi;
              break;
            }
          }
          var lineProps =
            finalIdx >= 0
              ? bundle.steps[finalIdx].lineItemProperties || []
              : [];
          var propValues = {};
          for (var li = 0; li < lineProps.length; li++) {
            var lp = lineProps[li];
            propValues[lp.propertyKey] =
              lp.fieldType === 'CHECKBOX'
                ? lp.defaultChecked
                  ? 'Yes'
                  : ''
                : '';
          }

          function effectiveGid(originalGid) {
            return state.variantChoice[originalGid] || originalGid;
          }

          function renderStepBarBlock(wrapEl, b, ctx) {
            if (!ctx || !ctx.steps || ctx.steps.length < 2) return;
            var st = b.style || {};
            var bar = document.createElement('div');
            bar.className = 'sar-stepbar';

            var activeIdx = ctx.stepIndex;
            var isShowLine = st.showLine !== false;

            // Set CSS vars for the whole bar
            bar.style.setProperty('--sar-stepbar-borderColor', st.borderColor || 'transparent');
            bar.style.setProperty('--sar-stepbar-lineColor', st.lineColor || st.borderColor || '#e1e3e5');
            bar.style.setProperty('--sar-stepbar-active-bg', st.activeBg || 'var(--sar-color-primary, #72cff7)');
            bar.style.setProperty('--sar-stepbar-completed-bg', st.completedBg || st.activeBg || 'var(--sar-color-primary, #72cff7)');
            bar.style.setProperty('--sar-stepbar-inactive-bg', st.inactiveBg || '#f1f1f1');
            bar.style.setProperty('--sar-stepbar-active-text', st.activeTextColor || '#ffffff');
            bar.style.setProperty('--sar-stepbar-inactive-text', st.inactiveTextColor || '#999999');
            bar.style.setProperty('--sar-stepbar-hover-bg', st.hoverBg || '');
            bar.style.setProperty('--sar-stepbar-hover-text', st.hoverTextColor || '');
            bar.style.setProperty('--sar-stepbar-label-color', st.labelColor || '#666');
            if (st.fontSize) bar.style.setProperty('--sar-stepbar-font-size', st.fontSize);

            for (var i = 0; i < ctx.steps.length; i++) {
              (function(idx) {
                var stepInfo = ctx.steps[idx] || {};
                var isActive = idx === activeIdx;
                var isCompleted = idx < activeIdx;

                var item = document.createElement('div');
                item.className = 'sar-stepbar__item' + (isActive ? ' active' : '') + (isCompleted ? ' completed' : '');
                item.style.flex = '1';
                item.style.position = 'relative';
                item.style.textAlign = 'center';
                item.style.cursor = 'pointer';

                // Horizontal Line
                if (idx < ctx.steps.length - 1 && isShowLine) {
                  var line = document.createElement("div");
                  line.className = "sar-stepbar__line";
                  item.appendChild(line);
                }

                // Circle Icon/Number
                var circle = document.createElement("div");
                circle.className = "sar-stepbar__icon-circle";

                if (stepInfo.imageUrl) {
                  var img = document.createElement('img');
                  img.src = stepInfo.imageUrl;
                  img.style.width = '24px';
                  img.style.height = '24px';
                  img.style.objectFit = 'contain';
                  circle.appendChild(img);
                } else {
                  var span = document.createElement('span');
                  span.textContent = String(idx + 1);
                  span.style.fontSize = '16px';
                  span.style.fontWeight = '600';
                  circle.appendChild(span);
                }
                item.appendChild(circle);

                // Label
                var label = document.createElement('div');
                label.className = 'sar-stepbar__label';
                label.textContent = (stepInfo.name || 'Étape ' + (idx + 1)).slice(0, 24);
                label.style.fontSize = 'var(--sar-stepbar-font-size, 12px)';
                label.style.color = isActive ? '#000' : 'var(--sar-stepbar-label-color)';
                label.style.fontWeight = isActive ? '600' : '400';
                item.appendChild(label);

                item.addEventListener('click', function(e) {
                  state.stepIndex = idx;
                  render();
                });

                bar.appendChild(item);
              })(i);
            }
            wrapEl.appendChild(bar);
          }

          function renderUpsellBlock(wrapEl, b, ctx) {
            var items = b.items || [];
            if (items.length === 0) return;

            var container = document.createElement('div');
            container.className = 'sar-bundle__upsell';
            container.style.margin = '24px 0';
            container.style.padding = '20px';
            container.style.background = '#fff';
            container.style.border = '1px solid #e1e3e5';
            container.style.borderRadius = '12px';
            container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';

            var title = document.createElement('div');
            title.style.marginBottom = '16px';
            title.style.fontSize = '18px';
            title.style.fontWeight = '700';
            title.textContent = b.title || (bundle.translations && bundle.translations.label_upsell_title) || 'Extra Options';
            container.appendChild(title);

            var list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '12px';
            container.appendChild(list);

            var behavior = b.behavior || 'multiple';

            for (var i = 0; i < items.length; i++) {
              (function(item) {
                var isSelected = state.upsellSelections[item.id];
                if (state.upsellSelections[item.id] === undefined && item.defaultEnabled) {
                  state.upsellSelections[item.id] = true;
                  isSelected = true;
                }

                var row = document.createElement('div');
                row.className = 'sar-bundle__upsell-item' + (isSelected ? ' is-selected' : '');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '12px';
                row.style.padding = '12px';
                row.style.borderRadius = '8px';
                row.style.border = '1px solid ' + (isSelected ? 'var(--sar-color-primary, #72cff7)' : '#e1e3e5');
                row.style.background = isSelected ? 'var(--sar-color-bg-subtle, #f0f7f5)' : 'transparent';
                row.style.cursor = 'pointer';
                row.style.transition = 'all 0.2s';

                var check = document.createElement('div');
                check.style.width = '20px';
                check.style.height = '20px';
                check.style.borderRadius = behavior === 'single' ? '50%' : '4px';
                check.style.border = '2px solid ' + (isSelected ? 'var(--sar-color-primary, #72cff7)' : '#d1d3d5');
                check.style.display = 'flex';
                check.style.alignItems = 'center';
                check.style.justifyContent = 'center';
                check.style.background = isSelected ? 'var(--sar-color-primary, #72cff7)' : '#fff';
                if (isSelected) {
                  var inner = document.createElement('div');
                  inner.style.width = behavior === 'single' ? '8px' : '10px';
                  inner.style.height = behavior === 'single' ? '8px' : '10px';
                  inner.style.borderRadius = behavior === 'single' ? '50%' : '2px';
                  inner.style.background = '#fff';
                  check.appendChild(inner);
                }
                row.appendChild(check);

                if (item.defaultImageUrl) {
                  var img = document.createElement('img');
                  img.src = item.defaultImageUrl;
                  img.style.width = '48px';
                  img.style.height = '48px';
                  img.style.objectFit = 'cover';
                  img.style.borderRadius = '4px';
                  row.appendChild(img);
                }

                var info = document.createElement('div');
                info.style.flex = '1';
                var lab = document.createElement('div');
                lab.style.fontWeight = '600';
                lab.style.fontSize = '14px';
                lab.textContent = item.overrideLabel || item.productTitle;
                info.appendChild(lab);
                if (item.shortDescription) {
                  var sd = document.createElement('div');
                  sd.style.fontSize = '12px';
                  sd.style.color = '#666';
                  sd.style.marginTop = '2px';
                  sd.textContent = item.shortDescription;
                  info.appendChild(sd);
                }
                row.appendChild(info);

                var price = document.createElement('div');
                price.style.fontWeight = '700';
                price.style.fontSize = '14px';
                price.style.color = 'var(--sar-color-primary, #72cff7)';
                price.textContent = '+' + formatMoneyDisplay(item.priceAmount, item.currencyCode);
                row.appendChild(price);

                row.addEventListener('click', function() {
                  if (behavior === 'single') {
                    for (var j = 0; j < items.length; j++) state.upsellSelections[items[j].id] = false;
                    state.upsellSelections[item.id] = true;
                  } else {
                    state.upsellSelections[item.id] = !state.upsellSelections[item.id];
                  }
                  render();
                });

                list.appendChild(row);
              })(items[i]);
            }
            wrapEl.appendChild(container);
          }

          function fetchCollectionProducts(handle) {
            if (!handle) return Promise.resolve(null);
            if (collectionProductsByHandle[handle]) {
              return Promise.resolve(collectionProductsByHandle[handle]);
            }
            if (collectionFetchInFlight[handle]) return collectionFetchInFlight[handle];
            // 'all' means all products — use /products.json
            var url = handle === 'all'
              ? joinRoot('products.json?limit=24')
              : joinRoot('collections/' + encodeURIComponent(handle) + '/products.json?limit=24');
            collectionFetchInFlight[handle] = fetch(
              url,
              { headers: { Accept: 'application/json' } },
            )
              .then(function (r) {
                return r.ok ? r.json() : null;
              })
              .then(function (j) {
                var arr = j && j.products ? j.products : null;
                collectionProductsByHandle[handle] = arr;
                return arr;
              })
              .catch(function () {
                collectionProductsByHandle[handle] = null;
                return null;
              })
              .finally(function () {
                collectionFetchInFlight[handle] = null;
              });
            return collectionFetchInFlight[handle];
          }

          function renderProductListBlock(wrapEl, b, ctx) {
            // Marqueur pour empêcher le rendu par défaut en-dessous.
            ctx.__renderedProductList = true;
            ctx.__productListCardLayout = b.cardLayout || 'classic';
            ctx.__productListColumns = b.columns || 3;
            ctx.__productListColumnsMobile = b.columnsMobile || 2;
            ctx.__productListSource = b.source || 'step_pick';
            ctx.__productListCollection = b.collectionHandle || '';
            ctx.__productListButtonText = b.buttonText || '';
            ctx.__productListButtonBackground = b.buttonBackground || '';
            ctx.__productListButtonColor = b.buttonColor || '';
            ctx.__productListButtonHoverBg = b.buttonHoverBackground || '';
            ctx.__productListButtonHoverColor = b.buttonHoverColor || '';
            ctx.__productListButtonRadius = b.buttonBorderRadius || '';
            ctx.__productListButtonBorderRadius = b.buttonBorderRadius || '';

            var container = document.createElement('div');
            container.className = 'sar-bundle__products';

            // Set CSS vars on container for buttons to inherit
            if (b.buttonBackground) container.style.setProperty('--sar-color-primary', b.buttonBackground);
            if (b.buttonColor) container.style.setProperty('--sar-button-text', b.buttonColor);
            if (b.buttonBorderRadius) container.style.setProperty('--sar-button-radius', b.buttonBorderRadius);

            ctx.__productListMount = container;
            wrapEl.appendChild(container);
          }

          function renderDesignBlocks(container, design, ctx, variantCache) {
            if (!design || (design.version !== 1 && design.version !== 2)) return;
            var g = design.global || {};
            if (g.fontBody) container.style.fontFamily = g.fontBody;
            var wrap = document.createElement('div');
            wrap.className = 'sar-bundle__design';
            if (g.contentMaxWidth) wrap.style.maxWidth = g.contentMaxWidth;
            if (g.pageBackground) wrap.style.background = g.pageBackground;
            wrap.style.marginBottom = '1rem';
            var blocks = design.blocks || [];
            for (var bi = 0; bi < blocks.length; bi++) {
              var b = blocks[bi];
              if (!b || !b.type) continue;
              var st = b.style || {};

              var blockWrap = wrap;
              var isInteractive = ctx.__explicitBundleData && ctx.__explicitBundleData.__editorMode;
              if (isInteractive) {
                blockWrap = document.createElement('div');
                blockWrap.style.position = 'relative';
                blockWrap.style.transition = 'all 0.2s';
                blockWrap.style.borderRadius = '4px';
                blockWrap.style.cursor = 'pointer';
                // Enforce an explicit border when selected
                if (ctx.__explicitBundleData.__selectedBlockId === b.id) {
                  blockWrap.style.boxShadow = '0 0 0 2px var(--p-color-border-interactive-focus)';
                  blockWrap.style.background = 'var(--p-color-bg-surface-secondary-hover)';
                }
                blockWrap.addEventListener('click', (function(id) {
                  return function(e) {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('sar-editor-select-block', { detail: id }));
                  };
                })(b.id));

                blockWrap.addEventListener('mouseenter', function(e) {
                  e.currentTarget.style.boxShadow = '0 0 0 2px var(--p-color-border-interactive-focus)';
                });
                blockWrap.addEventListener('mouseleave', function(e) {
                  if (ctx.__explicitBundleData.__selectedBlockId !== b.id) {
                    e.currentTarget.style.boxShadow = 'none';
                  }
                });
              }

              if (b.type === 'heading') {
                var hx = document.createElement(b.tag || 'h2');
                hx.textContent = b.text || '';
                applyTextStyle(hx, st);
                blockWrap.appendChild(hx);
              } else if (b.type === 'text') {
                var p = document.createElement('p');
                p.textContent = b.text || '';
                applyTextStyle(p, st);
                blockWrap.appendChild(p);
              } else if (b.type === 'image' && b.url) {
                var im = document.createElement('img');
                im.src = b.url;
                im.alt = b.alt || '';
                im.loading = 'lazy';
                im.style.display = 'block';
                im.style.maxWidth = st.maxWidth || '100%';
                applyTextStyle(im, st);
                blockWrap.appendChild(im);
              } else if (b.type === 'spacer') {
                var sp = document.createElement('div');
                sp.style.height = (b.height || 8) + 'px';
                blockWrap.appendChild(sp);
              } else if (b.type === 'hero') {
                var hero = document.createElement('section');
                hero.className =
                  'sar-bundle__hero sar-bundle__hero--' + (b.layout || 'stack');
                if (b.imageUrl) {
                  var him = document.createElement('img');
                  him.src = b.imageUrl;
                  him.alt = '';
                  him.loading = 'lazy';
                  him.className = 'sar-bundle__hero-img';
                  hero.appendChild(him);
                }
                var hcol = document.createElement('div');
                hcol.className = 'sar-bundle__hero-text';
                var hh = document.createElement('h2');
                hh.textContent = b.headline || '';
                hcol.appendChild(hh);
                if (b.subtext) {
                  var hs = document.createElement('p');
                  hs.textContent = b.subtext;
                  hcol.appendChild(hs);
                }
                hero.appendChild(hcol);
                blockWrap.appendChild(hero);
              } else if (b.type === 'split') {
                var spl = document.createElement('section');
                spl.className =
                  'sar-bundle__split sar-bundle__split--img-' +
                  (b.imageSide === 'right' ? 'right' : 'left');
                if (b.imageUrl) {
                  var sim = document.createElement('img');
                  sim.src = b.imageUrl;
                  sim.alt = '';
                  sim.loading = 'lazy';
                  sim.className = 'sar-bundle__split-img';
                  spl.appendChild(sim);
                }
                var scol = document.createElement('div');
                scol.className = 'sar-bundle__split-body';
                var sh = document.createElement('h3');
                sh.textContent = b.title || '';
                scol.appendChild(sh);
                var sbody = document.createElement('p');
                sbody.textContent = b.body || '';
                scol.appendChild(sbody);
                spl.appendChild(scol);
                blockWrap.appendChild(spl);
              } else if (b.type === 'step_bar') {
                renderStepBarBlock(blockWrap, b, ctx);
              } else if (b.type === 'product_list') {
                renderProductListBlock(blockWrap, b, ctx);
              } else if (b.type === 'upsell') {
                renderUpsellBlock(blockWrap, b, ctx);
              }

              if (isInteractive) {
                wrap.appendChild(blockWrap);
              }
            }
            if (wrap.childNodes.length) container.appendChild(wrap);
          }

          function applyTextStyle(el, st) {
            if (!st) return;
            if (st.fontSize) el.style.fontSize = st.fontSize;
            if (st.fontWeight) el.style.fontWeight = st.fontWeight;
            if (st.color) el.style.color = st.color;
            if (st.backgroundColor) el.style.backgroundColor = st.backgroundColor;
            if (st.textAlign) el.style.textAlign = st.textAlign;
            if (st.marginTop) el.style.marginTop = st.marginTop;
            if (st.marginBottom) el.style.marginBottom = st.marginBottom;
            if (st.padding) el.style.padding = st.padding;
            if (st.borderRadius) el.style.borderRadius = st.borderRadius;
            if (st.borderWidth) el.style.borderWidth = st.borderWidth;
            if (st.borderColor) el.style.borderColor = st.borderColor;
            if (st.fontFamily) el.style.fontFamily = st.fontFamily;
          }

          function applyProductCardStyles(card, so) {
            if (!so) return;
            if (so.cardBackground) card.style.background = so.cardBackground;
            if (so.cardBorderRadius) card.style.borderRadius = so.cardBorderRadius;
          }

          function render() {
            inner.innerHTML = '';
            var errBox = document.createElement('div');
            errBox.className = 'sar-bundle__error';
            errBox.hidden = true;
            inner.appendChild(errBox);

            var designCtx = {
              steps: bundle.steps,
              stepIndex: state.stepIndex,
              __renderedProductList: false,
              __productListMount: null,
              __explicitBundleData: explicitBundleData
            };
            // Title (block setting on product page)
            var h = document.createElement('h2');
            h.className = 'sar-bundle__title';
            h.textContent = heading;
            inner.appendChild(h);

            var step = bundle.steps[state.stepIndex];
            var isLast = state.stepIndex === bundle.steps.length - 1;

            // Step bar (block) — rendered before other design blocks
            var blocks = (bundle.storefrontDesign && bundle.storefrontDesign.blocks) || [];
            for (var sbi = 0; sbi < blocks.length; sbi++) {
              var sb = blocks[sbi];
              if (sb && sb.type === 'step_bar') {
                renderStepBarBlock(inner, sb, designCtx);
              }
            }

            if (showProgress && (!bundle.storefrontDesign || !bundle.storefrontDesign.blocks || bundle.storefrontDesign.blocks.length === 0)) {
              var pills = document.createElement('div');
              pills.className = 'sar-bundle__steps';
              for (var pi = 0; pi < bundle.steps.length; pi++) {
                var s = bundle.steps[pi];
                var pill = document.createElement('span');
                pill.className =
                  'sar-bundle__step-pill' +
                  (pi === state.stepIndex
                    ? ' sar-bundle__step-pill--active'
                    : '');
                pill.textContent = (s.name || 'Étape ' + (pi + 1)).slice(
                  0,
                  48,
                );
                pills.appendChild(pill);
              }
              inner.appendChild(pills);
            }

            // Design blocks (editor order), excluding step bar (already rendered above)
            // Use per-step design if available, fall back to global design
            var effectiveDesign = bundle.storefrontDesign;
            if (bundle.storefrontDesign && bundle.storefrontDesign.stepDesigns) {
              var stepKey = String(state.stepIndex);
              var stepBlocks = bundle.storefrontDesign.stepDesigns[stepKey];
              if (stepBlocks !== undefined) {
                effectiveDesign = Object.assign({}, bundle.storefrontDesign, { blocks: stepBlocks });
              }
            }
            if (effectiveDesign) {
              var designMount = document.createElement('div');
              renderDesignBlocks(designMount, effectiveDesign, designCtx, variantCache);
              // Drop only nested step bars from the design mount (they were already rendered above)
              var toRemove = designMount.querySelectorAll('.sar-stepbar');
              for (var ri = 0; ri < toRemove.length; ri++) {
                var n = toRemove[ri];
                if (n && n.parentNode) n.parentNode.removeChild(n);
              }
              // Append remaining design blocks (including product_list containers)
              while (designMount.firstChild) {
                inner.appendChild(designMount.firstChild);
              }
            }

            var body = document.createElement('div');
            body.className = 'sar-bundle__body';
            if (step.description) {
              var desc = document.createElement('p');
              desc.textContent = step.description;
              body.appendChild(desc);
            }

            var grid = designCtx.__productListMount || document.createElement('div');
            if (!designCtx.__productListMount) grid.className = 'sar-bundle__products';
            var stepProds = step.products || [];

            // Always render products - whether from a product_list block or default fallback
            {
              if (designCtx.__productListMount) {
                var colsDesk = designCtx.__productListColumns || 3;
                var colsMobile = designCtx.__productListColumnsMobile || Math.min(2, colsDesk);
                designCtx.__productListMount.style.setProperty('--grid-cols-desktop', colsDesk);
                designCtx.__productListMount.style.setProperty('--grid-cols-mobile', colsMobile);
                designCtx.__productListMount.style.setProperty('--grid-gap-x', '16px');
                designCtx.__productListMount.style.setProperty('--grid-gap-y', '16px');
                designCtx.__productListMount.style.display = 'grid';
              }
              function renderProductsLoop() {
                for (var pj = 0; pj < stepProds.length; pj++) {
                (function (prodRow) {
                  var originalGid = prodRow.variantGid;
                  var layoutConfig = designCtx.__productListCardLayout || 'classic';
                  var so = prodRow.styleOverrides || {};
                  var ph =
                    prodRow.productHandle ||
                    (prodRow.storefront && prodRow.storefront.productHandle) ||
                    '';

                  function gidNow() {
                    return effectiveGid(originalGid);
                  }
                  function getMeta() {
                    return variantCache[gidNow()] || {};
                  }
                  var sf = prodRow.storefront;

                  var card = document.createElement('div');
                  card.className = 'sar-bundle__product sar-bundle__product--' + layoutConfig;

                  var imgWrapper = document.createElement('div');
                  imgWrapper.className = 'sar-bundle__product-img-wrapper';

                  var img = document.createElement('img');
                  img.loading = 'lazy';
                  img.alt = '';

                  function refreshImgTitle() {
                    if (sf && sf.imageUrl) {
                      img.src = sf.imageUrl;
                      img.alt = sf.productTitle || sf.displayTitle || '';
                      return;
                    }
                    if (
                      ph &&
                      productJsonByHandle[ph] &&
                      productJsonByHandle[ph].images &&
                      productJsonByHandle[ph].images[0]
                    ) {
                      var im0 = productJsonByHandle[ph].images[0];
                      var imUrl = typeof im0 === 'string' ? im0 : (im0 && im0.src ? im0.src : '');
                      if (imUrl) {
                        img.src = imUrl;
                        img.alt = productJsonByHandle[ph].title || '';
                        return;
                      }
                    }
                    var m = getMeta();
                    if (m.featured_image && m.featured_image.src) {
                      img.src = m.featured_image.src;
                    } else if (typeof m.featured_image === 'string') {
                      img.src = m.featured_image;
                    } else {
                      img.style.display = 'none';
                    }
                    img.alt = (m.title && m.title !== 'Default Title' ? m.title : '') || '';
                  }
                  refreshImgTitle();
                  if (img.src) imgWrapper.appendChild(img);

                  var tt = document.createElement('p');
                  tt.className = 'sar-bundle__product-title';

                  var pr = document.createElement('p');
                  pr.className = 'sar-bundle__product-price';

                  function refreshTitlePrice() {
                    if (sf && sf.displayTitle) {
                      tt.textContent = sf.displayTitle;
                      pr.textContent = formatMoneyDisplay(sf.priceAmount, sf.currencyCode);
                      return;
                    }
                    var m = getMeta();
                    var rawTitle = m.title;
                    if (ph && productJsonByHandle[ph] && productJsonByHandle[ph].title) {
                      rawTitle = productJsonByHandle[ph].title;
                    } else if (!rawTitle || rawTitle === 'Default Title') {
                      rawTitle = (m.name && String(m.name)) || originalGid.split('/').pop();
                    }
                    tt.textContent = rawTitle;
                    var pVal = m.price;
                    pr.textContent = pVal != null ? formatMoneyDisplay(String(pVal), m.currencyCode) : '—';
                  }
                  refreshTitlePrice();

                  var atcWrapper = document.createElement('div');
                  atcWrapper.className = 'sar-bundle__product-atc-wrapper';

                  function setQty(q) {
                    state.selections[originalGid] = q;
                    state.selected[originalGid] = q > 0;
                    errBox.hidden = true;
                    render();
                  }

                  var qCurrent = state.selections[originalGid] || 0;
                  var isSelected = qCurrent > 0;

                  var atcText = (bundle.translations && bundle.translations.btn_add_to_box) || designCtx.__productListButtonText || (bundle.storefrontDesign && bundle.storefrontDesign.global && bundle.storefrontDesign.global.addToBoxText) || 'Add to box';

                  if (isSelected) {
                    atcWrapper.className += ' is-added';
                    var qtyBox = document.createElement('div');
                    qtyBox.className = 'sar-bundle__product-qty-box';

                    var minus = document.createElement('button');
                    minus.type = 'button';
                    minus.className = 'sar-bundle__product-qty-btn';
                    minus.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                    minus.addEventListener('click', function(e) { e.stopPropagation(); setQty(qCurrent - 1); });

                    var val = document.createElement('span');
                    val.className = 'sar-bundle__product-qty-val';
                    val.textContent = String(qCurrent);

                    var plus = document.createElement('button');
                    plus.type = 'button';
                    plus.className = 'sar-bundle__product-qty-btn';
                    plus.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                    plus.addEventListener('click', function(e) { e.stopPropagation(); setQty(qCurrent + 1); });

                    qtyBox.appendChild(minus);
                    qtyBox.appendChild(val);
                    qtyBox.appendChild(plus);
                    atcWrapper.appendChild(qtyBox);
                  } else {
                    var addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'sar-bundle__product-atc-btn';
                    addBtn.textContent = atcText;
                    if (designCtx.__productListButtonBackground) addBtn.style.background = designCtx.__productListButtonBackground;
                    if (designCtx.__productListButtonColor) addBtn.style.color = designCtx.__productListButtonColor;
                    if (designCtx.__productListButtonBorderRadius) addBtn.style.borderRadius = designCtx.__productListButtonBorderRadius;
                    if (designCtx.__productListButtonHoverBg || designCtx.__productListButtonHoverColor) {
                      var origBg = designCtx.__productListButtonBackground || '';
                      var origColor = designCtx.__productListButtonColor || '';
                      var hoverBg = designCtx.__productListButtonHoverBg;
                      var hoverColor = designCtx.__productListButtonHoverColor;
                      addBtn.addEventListener('mouseenter', function() {
                        if (hoverBg) this.style.background = hoverBg;
                        if (hoverColor) this.style.color = hoverColor;
                      });
                      addBtn.addEventListener('mouseleave', function() {
                        if (origBg) this.style.background = origBg; else this.style.background = '';
                        if (origColor) this.style.color = origColor; else this.style.color = '';
                      });
                    }

                    addBtn.addEventListener('click', function(e) { e.stopPropagation(); setQty(1); });
                    atcWrapper.appendChild(addBtn);
                  }

                  var infoBox = document.createElement('div');
                  infoBox.style.display = 'flex';
                  infoBox.style.flexDirection = 'column';
                  infoBox.style.gap = '4px';

                  if (layoutConfig === 'overlay') {
                    imgWrapper.appendChild(atcWrapper);
                    infoBox.appendChild(tt);
                    infoBox.appendChild(pr);
                    card.appendChild(imgWrapper);
                    card.appendChild(infoBox);
                  } else {
                    infoBox.appendChild(imgWrapper);
                    infoBox.appendChild(tt);
                    var textControlsWrap = document.createElement('div');
                    textControlsWrap.style.display = 'flex';
                    textControlsWrap.style.flexDirection = 'column';
                    textControlsWrap.style.justifyContent = 'space-between';
                    textControlsWrap.style.gap = '8px';
                    textControlsWrap.style.height = '100%';
                    textControlsWrap.appendChild(infoBox);
                    textControlsWrap.appendChild(atcWrapper);
                    card.appendChild(textControlsWrap);
                  }

                  grid.appendChild(card);
                })(stepProds[pj]);
                }

                // If no product_list block claimed the grid, put it in the body
                if (!designCtx.__renderedProductList) {
                  body.appendChild(grid);
                }

                // Always ensure body (description + products) is in the DOM
                inner.appendChild(body);
              }

              var isCollection = designCtx.__productListSource === 'collection' && designCtx.__productListCollection;
              var isAllProducts = designCtx.__productListSource === 'all_products';

              if (isCollection || isAllProducts) {
                var handle = isAllProducts ? 'all' : designCtx.__productListCollection;
                var loadId = 'loading-' + handle;
                if (!grid.querySelector('#' + loadId)) {
                  grid.innerHTML = '<div id="' + loadId + '" class="sar-bundle__loading">Chargement des produits...</div>';
                }
                fetchCollectionProducts(handle).then(function (products) {
                  grid.innerHTML = '';
                  stepProds = (products || []).map(function(p) {
                    var v0 = p.variants && p.variants[0];
                    var vId = v0 ? v0.id : null;
                    if (!vId) return null;
                    var gid = typeof vId === 'number' ? 'gid://shopify/ProductVariant/' + vId : vId;
                    variantCache[gid] = v0;
                    if (v0 && v0.price) priceMap[gid] = parseMoney(v0.price);
                    var img0 = p.images && p.images[0];
                    var url = typeof img0 === 'string' ? img0 : (img0 && img0.src ? img0.src : '');
                    return {
                      variantGid: gid,
                      storefront: {
                        imageUrl: url,
                        displayTitle: p.title,
                        priceAmount: v0 && v0.price ? String(v0.price) : '0',
                        currencyCode: typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.active || 'EUR',
                        productHandle: p.handle
                      }
                    };
                  }).filter(Boolean);
                  renderProductsLoop();
                });
              } else {
                renderProductsLoop();
              }
            }

            if (step.rules && step.rules.length) {
              var rh = document.createElement('div');
              rh.className = 'sar-bundle__rules';
              rh.textContent =
                'Des conditions doivent être respectées pour continuer.';
              body.appendChild(rh);
            }

            inner.appendChild(body);

            var totalsPreview = getTotals(
              state.selections,
              priceMap,
              state.variantChoice,
            );
            var disp = getDisplayedBundlePrice(bundle, totalsPreview);
            var cur = pickPrimaryCurrency(bundle, variantCache);
            var totalBox = document.createElement('div');
            totalBox.className = 'sar-bundle__bundle-total';
            var totalLabel = document.createElement('span');
            totalLabel.className = 'sar-bundle__bundle-total-label';
            totalLabel.textContent = (bundle.translations && bundle.translations.label_total) || 'Bundle total';
            var totalVal = document.createElement('span');
            totalVal.className = 'sar-bundle__bundle-total-value';
            if (disp.compareAt != null) {
              var cmpEl = document.createElement('s');
              cmpEl.className = 'sar-bundle__bundle-total-compare';
              cmpEl.textContent = formatMoneyDisplay(
                String(disp.compareAt),
                cur,
              );
              totalVal.appendChild(cmpEl);
              totalVal.appendChild(document.createTextNode(' '));
            }
            var mainEl = document.createElement('strong');
            mainEl.textContent = formatMoneyDisplay(String(disp.amount), cur);
            totalVal.appendChild(mainEl);
            totalBox.appendChild(totalLabel);
            totalBox.appendChild(totalVal);

            if (isLast && lineProps.length) {
              var fin = document.createElement('div');
              fin.className = 'sar-bundle__final';
              for (var lk = 0; lk < lineProps.length; lk++) {
                (function (lp) {
                  var wrap = document.createElement('div');
                  wrap.className = 'sar-bundle__field';
                  if (lp.fieldType === 'CHECKBOX') {
                    var lab = document.createElement('label');
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = propValues[lp.propertyKey] === 'Yes';
                    cb.addEventListener('change', function () {
                      propValues[lp.propertyKey] = cb.checked ? 'Yes' : '';
                    });
                    lab.appendChild(cb);
                    lab.appendChild(document.createTextNode(' ' + lp.label));
                    wrap.appendChild(lab);
                  } else {
                    var lab2 = document.createElement('label');
                    lab2.textContent = lp.label + (lp.required ? ' *' : '');
                    var inp = document.createElement('input');
                    inp.type = 'text';
                    inp.placeholder = lp.placeholder || '';
                    inp.value = propValues[lp.propertyKey] || '';
                    inp.required = !!lp.required;
                    inp.addEventListener('input', function () {
                      propValues[lp.propertyKey] = inp.value;
                    });
                    wrap.appendChild(lab2);
                    wrap.appendChild(inp);
                  }
                  fin.appendChild(wrap);
                })(lineProps[lk]);
              }
              inner.appendChild(fin);
            }

            var nav = document.createElement('div');
            nav.className = 'sar-bundle__nav';

            var prev = document.createElement('button');
            prev.type = 'button';
            prev.className = 'sar-bundle__btn sar-bundle__btn--secondary';
            prev.textContent = (bundle.translations && bundle.translations.btn_previous) || 'Previous';
            prev.disabled = state.stepIndex === 0;
            prev.addEventListener('click', function () {
              state.stepIndex--;
              errBox.hidden = true;
              render();
            });
            nav.appendChild(prev);

            var next = document.createElement('button');
            next.type = 'button';
            next.className = 'sar-bundle__btn sar-bundle__btn--primary';
            var txtAddToCart = (bundle.translations && bundle.translations.btn_add_to_cart) || 'Add to cart';
            var txtNext = (bundle.translations && bundle.translations.btn_next) || 'Next';
            next.textContent = isLast ? txtAddToCart : txtNext;
            next.addEventListener('click', function () {
              errBox.hidden = true;
              if (!isLast) {
                var vStep = validateStepRules(
                  bundle,
                  state.stepIndex,
                  state.selections,
                  priceMap,
                  state.variantChoice,
                );
                if (!vStep.ok) {
                  errBox.textContent = vStep.messages.join(' ');
                  errBox.hidden = false;
                  return;
                }
                state.stepIndex++;
                render();
                return;
              }

              var vAll = validateAllStepsForCheckout(
                bundle,
                state.selections,
                priceMap,
                state.variantChoice,
              );
              if (!vAll.ok) {
                errBox.textContent = vAll.messages.join(' ');
                errBox.hidden = false;
                return;
              }

              var totals = getTotals(
                state.selections,
                priceMap,
                state.variantChoice,
              );
              var requiredExact = requiredExactItemCountForBundle(bundle);
              if (requiredExact != null && !Number.isNaN(requiredExact)) {
                if (totals.totalItemCount !== requiredExact) {
                  errBox.textContent =
                    'This bundle requires exactly ' +
                    String(requiredExact) +
                    ' item(s). Currently: ' +
                    String(totals.totalItemCount) +
                    '.';
                  errBox.hidden = false;
                  return;
                }
              } else if (totals.totalItemCount < 1) {
                errBox.textContent = (bundle.translations && bundle.translations.label_select_product) || 'Select at least one product.';
                errBox.hidden = false;
                return;
              }

              var parentVariantGid = bundle.shopifyParentVariantId
                ? String(bundle.shopifyParentVariantId)
                : '';
              var parentNumericId = variantGidToNumericId(parentVariantGid);
              if (!parentNumericId) {
                errBox.textContent =
                  'Ce bundle n’a pas de produit parent Shopify (variante par défaut). Enregistrez le bundle dans l’app pour le créer.';
                errBox.hidden = false;
                return;
              }

              var configId = bundle.id ? String(bundle.id) : '';
              var components = buildBundleComponentsPayload(
                bundle,
                state.selections,
                state.variantChoice,
                variantCache,
                productJsonByHandle,
              );
              var componentsJson =
                serializeBundleComponentsProperty(components);

              var lineProps = {
                _sar_bundle_line: '1',
                _sar_bundle_config_id: configId,
              };
              if (bundle.name) {
                lineProps._sar_bundle_name = String(bundle.name);
              }

              var masterProps = Object.assign({}, lineProps);
              for (var pk in propValues) {
                if (!Object.prototype.hasOwnProperty.call(propValues, pk))
                  continue;
                var val = propValues[pk];
                if (val != null && val !== '') masterProps[pk] = String(val);
              }

              var artCount = 1;
              for (var ci = 0; ci < components.length; ci++) {
                var c = components[ci];
                if (!c || !c.quantity) continue;
                var name = c.productTitle || c.variantTitle || '';
                if (c.variantTitle && c.variantTitle !== 'Default Title' && c.variantTitle !== 'Default') {
                  name += ' - ' + c.variantTitle;
                }
                masterProps['Article ' + artCount] = c.quantity + 'x ' + name;
                if (c.imageUrl) {
                  masterProps['_image_' + artCount] = c.imageUrl;
                }
                artCount++;
              }

              var items = [];
              items.push({
                id: parentNumericId,
                quantity: 1,
                properties: masterProps,
              });

              // Add Upsells
              var designBlocks = (bundle.storefrontDesign && bundle.storefrontDesign.blocks) || [];
              for (var dbi = 0; dbi < designBlocks.length; dbi++) {
                var db = designBlocks[dbi];
                if (db.type === 'upsell') {
                  var uItems = db.items || [];
                  for (var uji = 0; uji < uItems.length; uji++) {
                    var uItem = uItems[uji];
                    if (state.upsellSelections[uItem.id]) {
                      items.push({
                        id: uItem.variantId || variantGidToNumericId(uItem.variantGid),
                        quantity: 1,
                        properties: {
                          _sar_upsell_for: configId,
                          _sar_bundle_name: String(bundle.name || '')
                        }
                      });
                    }
                  }
                }
              }

              fetch(joinRoot('cart/add.js'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: items,
                }),
              })
                .then(function (res) {
                  return res.json().then(function (j) {
                    return { res: res, j: j };
                  });
                })
                .then(function (_ref) {
                  if (!_ref.res.ok) {
                    errBox.textContent =
                      (_ref.j && _ref.j.message) || 'Erreur lors de l’ajout au panier.';
                    errBox.hidden = false;
                    return;
                  }
                  window.location.href = joinRoot('cart');
                })
                .catch(function () {
                  errBox.textContent = 'Erreur réseau.';
                  errBox.hidden = false;
                });
            });
            nav.appendChild(next);

            // Footer: total + nav on same line
            var footer = document.createElement('div');
            footer.className = 'sar-bundle__footer';
            footer.style.display = 'flex';
            footer.style.alignItems = 'center';
            footer.style.justifyContent = 'space-between';
            footer.style.gap = '1rem';
            footer.appendChild(totalBox);
            footer.appendChild(nav);
            inner.appendChild(footer);
          }

          render();
        });
      })
      .catch(function (err) {
        var msg =
          (err && err.message) ||
          'Impossible de charger le bundle (proxy, statut Actif, ou ID incorrect).';
        loading.textContent = msg;
        loading.classList.add('sar-bundle__error');
        console.error('[SAR Bundle]', err);
      });
  }

  function init() {
    var roots = document.querySelectorAll(
      '#sar-bundle-root, [data-sar-bundle-root]',
    );
    for (var i = 0; i < roots.length; i++) {
      mount(roots[i]).catch(function (e) {
        console.error('[SAR Bundle]', e);
      });
    }
  }

  window.SARBundleJS = {
    mount: mount,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
