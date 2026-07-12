// ================================================================
// C@NDY — Service d'authentification v2.1
// Correction : getRole() via RPC + fallback robuste
// ================================================================

const CandyAuth = (() => {

  let _sb      = null;
  let _user    = null;
  let _profile = null;
  let _role    = null;

  function init() {
    _sb = window.supabase.createClient(CANDY_SUPABASE_URL, CANDY_SUPABASE_KEY);
    return _sb;
  }

  function getClient() {
    if (!_sb) init();
    return _sb;
  }

  async function getSession() {
    const { data: { session } } = await getClient().auth.getSession();
    return session;
  }

  async function getUser() {
    if (_user) return _user;
    const session = await getSession();
    _user = session?.user || null;
    return _user;
  }

  async function getProfile() {
    if (_profile) return _profile;
    const user = await getUser();
    if (!user) return null;
    const { data, error } = await getClient()
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();  // maybeSingle évite l'erreur si 0 ligne
    if (error) console.warn('[CandyAuth] getProfile error:', error.message);
    _profile = data || null;
    return _profile;
  }

  async function getRole() {
    if (_role) return _role;
    // Essayer d'abord via le profil
    const profile = await getProfile();
    if (profile?.role) {
      _role = profile.role;
      return _role;
    }
    // Fallback : via RPC
    try {
      const { data } = await getClient().rpc('get_my_candy_role');
      _role = data || null;
      return _role;
    } catch(e) {
      console.warn('[CandyAuth] getRole RPC error:', e.message);
      return null;
    }
  }

  async function can(permission) {
    const role  = await getRole();
    const perms = CANDY_PERMISSIONS[role] || [];
    return perms.includes(permission);
  }

  async function hasRole(...roles) {
    const role = await getRole();
    return roles.includes(role);
  }

  async function login(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    _user    = data.user;
    _profile = null;
    _role    = null;
    try {
      await getClient().rpc('log_action', {
        p_action: 'LOGIN', p_details: { email }
      });
    } catch(e) { /* non bloquant */ }
    return data;
  }

  async function logout() {
    // Démo hors-ligne : la porte d'accès est sessionStorage, pas la session
    // Supabase (qui reste toujours valide côté mock). On nettoie les deux.
    try {
      await getClient().rpc('log_action', { p_action: 'LOGOUT' });
    } catch(e) { /* non bloquant */ }
    sessionStorage.removeItem('demo_auth');
    window.location.href = 'login.html';
  }

  async function requireAuth() {
    // Démo hors-ligne : le mock Supabase a toujours une session valide,
    // donc la vraie porte d'accès est ce flag sessionStorage posé par
    // login.html après saisie du mot de passe de démo.
    if (sessionStorage.getItem('demo_auth') !== 'true') {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  async function requireRole(...roles) {
    const ok = await requireAuth();
    if (!ok) return false;
    const role = await getRole();
    if (!role || !roles.includes(role)) {
      window.location.href = 'login.html?error=permission';
      return false;
    }
    return true;
  }

  async function redirectByRole() {
    const role = await getRole();
    const page = CANDY_REDIRECT[role] || 'login.html';
    window.location.href = page;
  }

  function onAuthChange(callback) {
    getClient().auth.onAuthStateChange((event, session) => {
      _user    = session?.user || null;
      _profile = null;
      _role    = null;
      callback(event, session);
    });
  }

  return {
    init, getClient, getSession, getUser, getProfile,
    getRole, can, hasRole, login, logout,
    requireAuth, requireRole, redirectByRole, onAuthChange,
  };

})();
