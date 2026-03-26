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

  function getTotals(selections, priceMap) {
    var bundlePrice = 0;
    var totalQty = 0;
    var distinct = {};
    var gid;
    for (gid in selections) {
      if (!Object.prototype.hasOwnProperty.call(selections, gid)) continue;
      var q = selections[gid] || 0;
      if (q <= 0) continue;
      totalQty += q;
      distinct[gid] = true;
      var unit = priceMap[gid] || 0;
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

  function validateStepRules(bundle, stepIndex, selections, priceMap) {
    var step = bundle.steps[stepIndex];
    if (!step || !step.rules || !step.rules.length)
      return { ok: true, messages: [] };
    var base = getTotals(selections, priceMap);
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
    return fetch(url, { headers: { Accept: 'application/json' } }).then(
      function (res) {
        if (!res.ok) return res.json().then(function (b) {
          throw new Error((b && b.error) || res.statusText);
        });
        return res.json();
      },
    );
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

  function mount(el) {
    var ref = (el.getAttribute('data-bundle-ref') || '').trim();
    var heading = el.getAttribute('data-heading') || 'Composez votre pack';
    var showProgress = el.getAttribute('data-show-progress') !== 'false';
    var loading = el.querySelector('[data-sar-loading]');
    var inner = el.querySelector('[data-sar-inner]');

    if (!ref) {
      loading.textContent = "Ajoutez l'ID du bundle dans les paramètres du bloc.";
      return Promise.resolve();
    }

    return fetchBundleConfig(ref)
      .then(function (bundle) {
        if (!bundle.steps || !bundle.steps.length) {
          loading.textContent = "Ce bundle n'a pas d'étapes.";
          return;
        }

        var priceMap = {};
        var variantCache = {};
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
        ).then(function () {
          loading.hidden = true;
          inner.hidden = false;

          var state = {
            stepIndex: 0,
            selections: {},
            selected: {},
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

          function render() {
            inner.innerHTML = '';
            var errBox = document.createElement('div');
            errBox.className = 'sar-bundle__error';
            errBox.hidden = true;
            inner.appendChild(errBox);

            var h = document.createElement('h2');
            h.className = 'sar-bundle__title';
            h.textContent = heading;
            inner.appendChild(h);

            var step = bundle.steps[state.stepIndex];
            var isLast = state.stepIndex === bundle.steps.length - 1;

            if (showProgress) {
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

            var body = document.createElement('div');
            body.className = 'sar-bundle__body';
            if (step.description) {
              var desc = document.createElement('p');
              desc.textContent = step.description;
              body.appendChild(desc);
            }

            var grid = document.createElement('div');
            grid.className = 'sar-bundle__products';
            var stepProds = step.products || [];

            for (var pj = 0; pj < stepProds.length; pj++) {
              (function (gid) {
                var meta = variantCache[gid] || {};
                var card = document.createElement('div');
                card.className =
                  'sar-bundle__product' +
                  (state.selected[gid]
                    ? ' sar-bundle__product--selected'
                    : '');
                card.addEventListener('click', function (e) {
                  if (e.target.tagName === 'INPUT') return;
                  state.selected[gid] = !state.selected[gid];
                  if (state.selected[gid] && (state.selections[gid] || 0) < 1) {
                    state.selections[gid] = 1;
                  }
                  if (!state.selected[gid]) state.selections[gid] = 0;
                  errBox.hidden = true;
                  render();
                });

                var img = document.createElement('img');
                img.alt = '';
                img.loading = 'lazy';
                if (meta.featured_image && meta.featured_image.src) {
                  img.src = meta.featured_image.src;
                } else if (typeof meta.featured_image === 'string') {
                  img.src = meta.featured_image;
                } else {
                  img.src =
                    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
                }
                card.appendChild(img);

                var tt = document.createElement('p');
                tt.className = 'sar-bundle__product-title';
                tt.textContent = meta.title || gid.split('/').pop();
                card.appendChild(tt);

                var pr = document.createElement('div');
                pr.className = 'sar-bundle__product-price';
                pr.textContent = meta.price != null ? String(meta.price) : '—';
                card.appendChild(pr);

                if (state.selected[gid]) {
                  var qtyIn = document.createElement('input');
                  qtyIn.type = 'number';
                  qtyIn.min = '1';
                  qtyIn.className = 'sar-bundle__qty';
                  qtyIn.value = String(state.selections[gid] || 1);
                  qtyIn.addEventListener('click', function (e) {
                    e.stopPropagation();
                  });
                  qtyIn.addEventListener('change', function () {
                    var q = parseInt(qtyIn.value, 10) || 1;
                    if (q < 1) q = 1;
                    state.selections[gid] = q;
                    qtyIn.value = String(q);
                  });
                  card.appendChild(qtyIn);
                }
                grid.appendChild(card);
              })(stepProds[pj].variantGid);
            }

            body.appendChild(grid);

            if (step.rules && step.rules.length) {
              var rh = document.createElement('div');
              rh.className = 'sar-bundle__rules';
              rh.textContent =
                'Des conditions doivent être respectées pour continuer.';
              body.appendChild(rh);
            }

            inner.appendChild(body);

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
            prev.textContent = 'Précédent';
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
            next.textContent = isLast ? 'Ajouter au panier' : 'Suivant';
            next.addEventListener('click', function () {
              errBox.hidden = true;
              var v = validateStepRules(
                bundle,
                state.stepIndex,
                state.selections,
                priceMap,
              );
              if (!v.ok) {
                errBox.textContent = v.messages.join(' ');
                errBox.hidden = false;
                return;
              }
              if (!isLast) {
                state.stepIndex++;
                render();
                return;
              }

              var bundleInstanceId =
                typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : String(Date.now()) + '-' + Math.random().toString(36).slice(2);

              var items = [];
              for (var gk in state.selections) {
                if (!Object.prototype.hasOwnProperty.call(state.selections, gk))
                  continue;
                if (!state.selected[gk] || (state.selections[gk] || 0) <= 0)
                  continue;
                var vid = variantGidToNumericId(gk);
                if (!vid) continue;
                items.push({
                  id: vid,
                  quantity: state.selections[gk],
                  properties: { _sar_bundle_id: bundleInstanceId },
                });
              }

              if (!items.length) {
                errBox.textContent = 'Sélectionnez au moins un produit.';
                errBox.hidden = false;
                return;
              }

              var masterProps = { _sar_bundle_id: bundleInstanceId };
              for (var pk in propValues) {
                if (!Object.prototype.hasOwnProperty.call(propValues, pk))
                  continue;
                var val = propValues[pk];
                if (val != null && val !== '') masterProps[pk] = String(val);
              }
              items[0].properties = Object.assign(
                {},
                items[0].properties,
                masterProps,
              );

              fetch(joinRoot('cart/add.js'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items }),
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
            inner.appendChild(nav);
          }

          render();
        });
      })
      .catch(function () {
        loading.textContent =
          'Impossible de charger le bundle (proxy, statut Actif, ou ID incorrect).';
        loading.classList.add('sar-bundle__error');
      });
  }

  function init() {
    var roots = document.querySelectorAll('[data-sar-bundle-root]');
    for (var i = 0; i < roots.length; i++) {
      mount(roots[i]).catch(function (e) {
        console.error('[SAR Bundle]', e);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
