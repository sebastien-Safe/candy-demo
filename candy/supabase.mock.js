// ================================================================
// C@NDY — Faux client Supabase pour la démonstration hors-ligne
// Remplace le SDK @supabase/supabase-js chargé depuis un CDN.
// AUCUN appel réseau n'est jamais effectué par ce fichier.
// ================================================================

(function () {

  const FAKE_USER = { id: 'demo-medecin', email: 'demo@candy-demo.local' };
  const FAKE_SESSION = { user: FAKE_USER, access_token: 'mock-token', token_type: 'bearer' };

  function _tables() {
    return (window.CANDY_MOCK_DATA) || {};
  }

  function _getStore(table) {
    const data = _tables();
    if (!Object.prototype.hasOwnProperty.call(data, table)) {
      console.warn('[candy mock supabase] unknown table', table);
      data[table] = [];
    }
    return data[table];
  }

  function _genId(table) {
    return 'mock-' + table + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function _cmp(a, b, ascending) {
    if (a == null && b == null) return 0;
    if (a == null) return ascending ? -1 : 1;
    if (b == null) return ascending ? 1 : -1;
    if (a < b) return ascending ? -1 : 1;
    if (a > b) return ascending ? 1 : -1;
    return 0;
  }

  // ── Query builder chaînable + thenable ──
  function createQueryBuilder(table) {
    const state = {
      table,
      op: 'select',
      payload: null,
      opts: null,
      filters: [],   // { type: 'eq'|'is'|'gte'|'lte', col, val }
      orderCol: null,
      orderOpts: null,
      rangeArgs: null,
      limitN: null,
      singleMode: null, // 'single' | 'maybeSingle'
    };

    const builder = {
      select(_cols) {
        // .select() ne change pas l'opération si .insert()/.update()/.upsert()
        // a déjà été appelé plus tôt dans la chaîne (ex: .insert(x).select()).
        return builder;
      },
      eq(col, val) { state.filters.push({ type: 'eq', col, val }); return builder; },
      is(col, val) { state.filters.push({ type: 'is', col, val }); return builder; },
      gte(col, val) { state.filters.push({ type: 'gte', col, val }); return builder; },
      lte(col, val) { state.filters.push({ type: 'lte', col, val }); return builder; },
      order(col, opts) { state.orderCol = col; state.orderOpts = opts || {}; return builder; },
      range(a, b) { state.rangeArgs = [a, b]; return builder; },
      limit(n) { state.limitN = n; return builder; },
      single() { state.singleMode = 'single'; return builder; },
      maybeSingle() { state.singleMode = 'maybeSingle'; return builder; },
      insert(data) { state.op = 'insert'; state.payload = data; return builder; },
      update(data) { state.op = 'update'; state.payload = data; return builder; },
      upsert(data, opts) { state.op = 'upsert'; state.payload = data; state.opts = opts; return builder; },
      delete() { state.op = 'delete'; return builder; },
      then(onFulfilled, onRejected) {
        return Promise.resolve().then(() => _execute(state)).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return Promise.resolve().then(() => _execute(state)).catch(onRejected);
      },
    };

    return builder;
  }

  function _applyFilters(rows, filters) {
    return rows.filter(r => filters.every(f => {
      if (f.type === 'eq') return r[f.col] === f.val;
      if (f.type === 'is') return r[f.col] === f.val; // null-safe equality
      if (f.type === 'gte') return r[f.col] >= f.val;
      if (f.type === 'lte') return r[f.col] <= f.val;
      return true;
    }));
  }

  function _execute(state) {
    try {
      const store = _getStore(state.table);

      if (state.op === 'insert') {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = items.map(item => {
          const row = Object.assign({}, item);
          if (!('id' in row)) row.id = _genId(state.table);
          store.push(row);
          return row;
        });
        return { data: inserted, error: null };
      }

      if (state.op === 'update') {
        const matches = _applyFilters(store, state.filters);
        matches.forEach(r => Object.assign(r, state.payload));
        return { data: matches, error: null };
      }

      if (state.op === 'upsert') {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        const conflictCols = (state.opts && state.opts.onConflict)
          ? state.opts.onConflict.split(',').map(s => s.trim())
          : ['id'];
        const results = items.map(item => {
          const existing = store.find(r => conflictCols.every(c => r[c] === item[c]));
          if (existing) {
            Object.assign(existing, item);
            return existing;
          }
          const row = Object.assign({}, item);
          if (!('id' in row)) row.id = _genId(state.table);
          store.push(row);
          return row;
        });
        return { data: results, error: null };
      }

      if (state.op === 'delete') {
        const matches = _applyFilters(store, state.filters);
        matches.forEach(r => {
          const idx = store.indexOf(r);
          if (idx >= 0) store.splice(idx, 1);
        });
        return { data: null, error: null };
      }

      // ── select ──
      let rows = _applyFilters(store.slice(), state.filters);

      if (state.orderCol) {
        const ascending = !(state.orderOpts && state.orderOpts.ascending === false);
        rows = rows.slice().sort((a, b) => _cmp(a[state.orderCol], b[state.orderCol], ascending));
      }

      if (state.rangeArgs) {
        rows = rows.slice(state.rangeArgs[0], state.rangeArgs[1] + 1);
      }

      if (state.limitN != null) {
        rows = rows.slice(0, state.limitN);
      }

      if (state.singleMode === 'single') {
        if (!rows.length) return { data: null, error: { message: 'No rows found' } };
        return { data: rows[0], error: null };
      }
      if (state.singleMode === 'maybeSingle') {
        return { data: rows[0] || null, error: null };
      }
      return { data: rows, error: null };
    } catch (e) {
      console.warn('[candy mock supabase] query error', e);
      return { data: state.singleMode ? null : [], error: null };
    }
  }

  function createClient(_url, _key) {
    // _url / _key sont ignorés : aucune connexion réseau n'est jamais faite.
    const client = {
      from(table) {
        return createQueryBuilder(table);
      },
      async rpc(fn, params) {
        if (fn === 'get_my_candy_role') return { data: 'medecin', error: null };
        if (fn === 'log_action') return { data: null, error: null };
        console.warn('[candy mock supabase] unknown rpc', fn, params);
        return { data: null, error: null };
      },
      auth: {
        async getSession() {
          return { data: { session: FAKE_SESSION }, error: null };
        },
        async getUser() {
          return { data: { user: FAKE_USER }, error: null };
        },
        onAuthStateChange(cb) {
          try { cb('SIGNED_IN', FAKE_SESSION); } catch (e) { /* ignore */ }
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signOut() {
          return { error: null };
        },
        async signInWithPassword(_credentials) {
          return { data: { user: FAKE_USER, session: FAKE_SESSION }, error: null };
        },
      },
    };
    return client;
  }

  window.supabase = { createClient };

})();
