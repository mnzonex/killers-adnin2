async function signInWithGoogle() {
    const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html'
        }
    });
    if (error) alert(error.message);
}

async function signOut() {
    await window.supabaseClient.auth.signOut();
    window.location.href = window.location.origin;
}

async function checkSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    return session;
}

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.checkSession = checkSession;
