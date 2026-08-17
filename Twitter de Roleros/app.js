import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, setDoc,
    onSnapshot, orderBy, serverTimestamp, deleteDoc, doc, 
    updateDoc, arrayUnion, arrayRemove, increment 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ================= CONFIGURACIÓN =================
const firebaseConfig = {
  apiKey: "AIzaSyBd29zsaGhR8-vXMobqxsIrpcSHUspydGs",
  authDomain: "twitter-roleros.firebaseapp.com",
  projectId: "twitter-roleros",
  storageBucket: "twitter-roleros.firebasestorage.app",
  messagingSenderId: "258615624384",
  appId: "1:258615624384:web:6a5057d036f29bab60a325"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= VARIABLES GLOBALES =================
let currentUserRaw = localStorage.getItem('rolero_username') || null;
let currentUser = currentUserRaw ? currentUserRaw.toLowerCase().trim() : null;

// Variables faltantes agregadas para evitar ReferenceErrors
let globalUsersMap = {};
let currentUserRole = 'user';
let isModMode = false;
let isLoginMode = true;
let lastPostTime = 0;
let currentSearchTab = 'posts';

let currentChatUser = null; let unsubscribeChat = null; let unsubscribeChatMeta = null;
let unsubscribeThreadsList = null; let unsubscribeActiveThread = null; let activeThreadIdForMod = null; 
let typingTimeout = null; let otherUserReadTime = 0; 

let unsubscribePosts = null; let unsubscribeUsers = null; let unsubscribeNotifs = null;
let allGlobalPosts = []; const commentListeners = {}; 
let openComments = []; let commentDrafts = {}; let currentMessagesData = [];

// ================= REFERENCIAS DOM =================
const authView = document.getElementById('auth-view'); 
const appView = document.getElementById('app-view');
const authForm = document.getElementById('auth-form'); 
const authUsername = document.getElementById('auth-username'); 
const authPassword = document.getElementById('auth-password'); 
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login'); 
const tabRegister = document.getElementById('tab-register'); 
const authSubmit = document.getElementById('auth-submit');

const currentUsernameDisplay = document.getElementById('current-username'); 
const currentDisplayNameNode = document.getElementById('current-displayname'); 
const sidebarAvatar = document.getElementById('sidebar-avatar'); 
const creatorAvatar = document.getElementById('creator-avatar'); 
const btnLogout = document.getElementById('btn-logout');

const viewFeed = document.getElementById('view-feed'); 
const viewProfile = document.getElementById('view-profile'); 
const viewThreads = document.getElementById('view-threads'); 
const viewMessages = document.getElementById('view-messages'); 
const viewMod = document.getElementById('view-mod'); 
const viewNotifs = document.getElementById('view-notifs'); 
const viewSinglePost = document.getElementById('view-single-post');
const viewSearch = document.getElementById('view-search');

const postContent = document.getElementById('post-content'); 
const btnCreatePost = document.getElementById('btn-create-post'); 
const postsContainer = document.getElementById('posts-container'); 
const profilePostsContainer = document.getElementById('profile-posts-container'); 
const trendsContainer = document.getElementById('trends-container');

const imageModal = document.getElementById('image-modal'); 
const modalImage = document.getElementById('modal-image'); 
const mentionsDropdown = document.getElementById('mentions-dropdown');
const postImageUpload = document.getElementById('post-image-upload'); 
const postImagePreviewContainer = document.getElementById('post-image-preview-container'); 
const postImagePreview = document.getElementById('post-image-preview'); 
const btnRemoveImage = document.getElementById('btn-remove-image'); 
let currentBase64PostImage = null;

const editProfileAvatar = document.getElementById('edit-profile-avatar'); 
const btnEditAvatar = document.getElementById('btn-edit-avatar');

const onboardingModal = document.getElementById('onboarding-modal'); 
const onboardAvatarInput = document.getElementById('onboard-avatar'); 
const onboardAvatarPreview = document.getElementById('onboard-avatar-preview'); 
const onboardDisplaynameInput = document.getElementById('onboard-displayname'); 
const btnSaveOnboarding = document.getElementById('btn-save-onboarding');
let onboardBase64Avatar = "https://i.imgur.com/6YGWg0A.png";
let onboardBase64Banner = null;

// ================= INICIALIZACIÓN Y ENRUTAMIENTO =================
function init() { 
    if (currentUser) { listenToGlobalUsers(); showApp(); } 
    else { showAuth(); } 
}

window.addEventListener('hashchange', handleRouting);

window.setFeedTab = function(tab) {
    currentFeedTab = tab;
    const tabViral = document.getElementById('tab-feed-viral');
    const tabNuevos = document.getElementById('tab-feed-nuevos');

    if (tab === 'viral') {
        if (tabViral) { tabViral.classList.add('active'); tabViral.style.color = 'var(--text-main)'; tabViral.style.borderBottom = '3px solid var(--accent-primary)'; }
        if (tabNuevos) { tabNuevos.classList.remove('active'); tabNuevos.style.color = 'var(--text-muted)'; tabNuevos.style.borderBottom = '3px solid transparent'; }
    } else {
        if (tabNuevos) { tabNuevos.classList.add('active'); tabNuevos.style.color = 'var(--text-main)'; tabNuevos.style.borderBottom = '3px solid var(--accent-primary)'; }
        if (tabViral) { tabViral.classList.remove('active'); tabViral.style.color = 'var(--text-muted)'; tabViral.style.borderBottom = '3px solid transparent'; }
    }

    // Refrescar el feed
    if (viewFeed && !viewFeed.classList.contains('hidden') && postsContainer) {
        renderFeed(allGlobalPosts, postsContainer, currentFeedTab === 'viral');
    }
}

function handleRouting() {
    if (!currentUser) return;
    const hash = window.location.hash;
    
    if (hash.startsWith('#/@')) {
        const path = hash.substring(2); 
        const parts = path.split('/'); 
        const userToView = parts[0].substring(1); 
        
        if (parts.length === 3 && parts[1] === 'status') {
            const postIdToView = parts[2];
            showSinglePost(postIdToView);
        } else {
            window.showProfile(userToView);
        }
    } else if (hash === '#threads') {
        hideAllViews(); viewThreads?.classList.remove('hidden'); document.getElementById('nav-threads')?.classList.add('active'); 
        document.getElementById('thread-list-container')?.classList.remove('hidden'); document.getElementById('active-thread-container')?.classList.add('hidden'); loadThreadsList(); 
    } else if (hash === '#messages') {
        hideAllViews(); viewMessages?.classList.remove('hidden'); document.getElementById('nav-messages')?.classList.add('active');
        document.querySelector('.app-layout')?.classList.add('messages-mode'); document.getElementById('right-panel')?.classList.add('hidden');
        document.getElementById('chat-area')?.classList.add('hidden'); document.getElementById('chat-placeholder')?.classList.remove('hidden');
        renderChatSidebar();
    } else if (hash === '#notifs') {
        hideAllViews(); viewNotifs?.classList.remove('hidden'); document.getElementById('nav-notifs')?.classList.add('active'); 
        const myId = globalUsersMap[currentUser]?.id; if (myId) updateDoc(doc(db, "users", myId), { unreadNotifs: 0 }); 
    } else if (hash === '#mod') {
        hideAllViews(); viewMod?.classList.remove('hidden'); document.getElementById('nav-mod')?.classList.add('active'); 
        const searchInput = document.getElementById('mod-search-input'); renderModPanel(searchInput ? searchInput.value.toLowerCase() : ""); 
    } else if (hash === '#search') {
        hideAllViews(); const vs = document.getElementById('view-search'); if (vs) vs.classList.remove('hidden'); document.getElementById('nav-search')?.classList.add('active'); 
    } else if (hash === '#feed') {
        // Ahora el feed principal tiene su propio hash seguro
        hideAllViews(); viewFeed?.classList.remove('hidden'); document.getElementById('nav-home')?.classList.add('active'); 
        if(allGlobalPosts.length > 0 && postsContainer) renderFeed(allGlobalPosts, postsContainer, currentFeedTab === 'viral');
    } else if (hash === '' || hash === '#') {
    // FORZAMOS a que al entrar/reiniciar te envíe directo al feed
    window.location.hash = '#feed';
   }
}

// Ahora los botones solo cambian el hash, obligando al sistema a navegar 100% seguro.
window.showThreadsView = function() { if(window.location.hash !== '#threads') window.location.hash = '#threads'; else handleRouting(); }
window.showModView = function() { if(window.location.hash !== '#mod') window.location.hash = '#mod'; else handleRouting(); }
window.showNotifsView = function() { if(window.location.hash !== '#notifs') window.location.hash = '#notifs'; else handleRouting(); }
window.showMessagesView = function() { if(window.location.hash !== '#messages') window.location.hash = '#messages'; else handleRouting(); }
window.showSearchView = function() { if(window.location.hash !== '#search') window.location.hash = '#search'; else handleRouting(); }

function showAuth() { 
    authView?.classList.remove('hidden'); 
    appView?.classList.add('hidden'); 
    if (unsubscribePosts) unsubscribePosts(); 
    if (unsubscribeUsers) unsubscribeUsers(); 
    if (unsubscribeNotifs) unsubscribeNotifs(); 
}

function showApp() { 
    authView?.classList.add('hidden'); 
    appView?.classList.remove('hidden'); 
    if(currentUsernameDisplay) currentUsernameDisplay.textContent = "@" + currentUser; 
    loadPostsRealtime(); 
    loadNotifsRealtime(); 
    handleRouting(); 
}

function hideAllViews() { 
    viewFeed?.classList.add('hidden'); 
    viewProfile?.classList.add('hidden'); 
    viewThreads?.classList.add('hidden'); 
    viewMessages?.classList.add('hidden'); 
    viewMod?.classList.add('hidden'); 
    viewNotifs?.classList.add('hidden'); 
    viewSinglePost?.classList.add('hidden');
    viewSearch?.classList.add('hidden');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('.app-layout')?.classList.remove('messages-mode');
    document.getElementById('right-panel')?.classList.remove('hidden');
}

window.showFeedView = function() {
    if (window.location.hash !== '#feed') {
        window.location.hash = '#feed';
    } else {
        handleRouting();
    }
}

window.goToMyProfile = function() { 
    if(window.location.hash !== `#/@${currentUser}`) {
        window.location.hash = `#/@${currentUser}`; 
    } else {
        handleRouting(); 
    }
}

window.showThreadsView = function() { 
    hideAllViews(); viewThreads?.classList.remove('hidden'); document.getElementById('nav-threads')?.classList.add('active'); 
    document.getElementById('thread-list-container')?.classList.remove('hidden'); document.getElementById('active-thread-container')?.classList.add('hidden'); loadThreadsList(); 
}

window.showModView = function() { 
    hideAllViews(); viewMod?.classList.remove('hidden'); document.getElementById('nav-mod')?.classList.add('active'); 
    const searchInput = document.getElementById('mod-search-input'); renderModPanel(searchInput ? searchInput.value.toLowerCase() : ""); 
}

window.showNotifsView = function() { 
    hideAllViews(); viewNotifs?.classList.remove('hidden'); document.getElementById('nav-notifs')?.classList.add('active'); 
    const myId = globalUsersMap[currentUser]?.id; if (myId) updateDoc(doc(db, "users", myId), { unreadNotifs: 0 }); 
}

window.showMessagesView = function() {
    hideAllViews(); viewMessages?.classList.remove('hidden'); document.getElementById('nav-messages')?.classList.add('active');
    document.querySelector('.app-layout')?.classList.add('messages-mode'); document.getElementById('right-panel')?.classList.add('hidden');
    document.getElementById('chat-area')?.classList.add('hidden'); document.getElementById('chat-placeholder')?.classList.remove('hidden');
    renderChatSidebar();
}

window.closeChatMobile = function() { document.getElementById('chat-area')?.classList.add('hidden'); document.getElementById('chat-placeholder')?.classList.remove('hidden'); currentChatUser = null; if(unsubscribeChat) unsubscribeChat(); if(unsubscribeChatMeta) unsubscribeChatMeta(); renderChatSidebar(); }
window.openImageModal = function(src) { if(modalImage) modalImage.src = src; imageModal?.classList.remove('hidden'); }
window.closeImageModal = function() { imageModal?.classList.add('hidden'); if(modalImage) modalImage.src = ""; }

// Agrega esta nueva función en la sección de "INICIALIZACIÓN Y ENRUTAMIENTO" (cerca de window.showFeedView)
window.showSearchView = function() { 
    hideAllViews(); 
    const viewSearch = document.getElementById('view-search');
    if (viewSearch) viewSearch.classList.remove('hidden'); 
    document.getElementById('nav-search')?.classList.add('active'); 
}

// ================= COMPRESIÓN IMÁGENES =================
function compressImage(file, maxSize, callback) {
    const reader = new FileReader(); reader.onload = function(event) { const img = new Image(); img.onload = function() {
        const canvas = document.createElement('canvas'); let width = img.width; let height = img.height;
        if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
        canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', 0.8));
    }; img.src = event.target.result; }; reader.readAsDataURL(file);
}

// ================= LISTENER USUARIOS Y ONBOARDING =================
function listenToGlobalUsers() {
    const q = query(collection(db, "users")); if(unsubscribeUsers) unsubscribeUsers();
    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        globalUsersMap = {};
        snapshot.forEach(doc => { 
            const data = doc.data(); const rawName = data.usernameLower || data.username || "";
            const safeKey = rawName.toLowerCase().trim();
            if(safeKey) { globalUsersMap[safeKey] = { id: doc.id, ...data }; }
        });
        
        const myData = globalUsersMap[currentUser];
        let dbRole = (myData?.role || 'user').toLowerCase();
        if (currentUser === 'trixxie') dbRole = 'admin'; 
        
        currentUserRole = dbRole;
        isModMode = (currentUserRole === 'admin' || currentUserRole === 'mod');

        const navMod = document.getElementById('nav-mod'); const btnNuke = document.getElementById('btn-nuke-feed');
        if (isModMode) { if(navMod) navMod.classList.remove('hidden'); if(btnNuke) btnNuke.classList.remove('hidden'); } 
        else { if(navMod) navMod.classList.add('hidden'); if(btnNuke) btnNuke.classList.add('hidden'); }

        if (myData) {
            if (myData.banned) { alert("Has sido exiliado."); document.getElementById('btn-logout')?.click(); return; }

            if (!myData.displayName || myData.avatar === "https://i.imgur.com/6YGWg0A.png" || !myData.banner || !myData.bio) {
    const onboardingModal = document.getElementById('onboarding-modal');
    if (onboardingModal) onboardingModal.classList.remove('hidden');
    
    if(myData.displayName && document.getElementById('onboard-displayname')) document.getElementById('onboard-displayname').value = myData.displayName;
    if(myData.bio && document.getElementById('onboard-bio')) document.getElementById('onboard-bio').value = myData.bio;
    
    if(myData.avatar && myData.avatar !== "https://i.imgur.com/6YGWg0A.png") {
        onboardBase64Avatar = myData.avatar;
        const avatarPreview = document.getElementById('onboard-avatar-preview');
        if (avatarPreview) avatarPreview.src = myData.avatar;
    }
    if(myData.banner) {
        onboardBase64Banner = myData.banner;
        const bannerPreview = document.getElementById('onboard-banner-preview');
        if(bannerPreview) { bannerPreview.src = myData.banner; bannerPreview.style.display = 'block'; }
    }
} else { 
    document.getElementById('onboarding-modal')?.classList.add('hidden'); 
}

            if(sidebarAvatar) sidebarAvatar.src = myData.avatar || "https://i.imgur.com/6YGWg0A.png"; 
            if(creatorAvatar) creatorAvatar.src = myData.avatar || "https://i.imgur.com/6YGWg0A.png";
            if(currentDisplayNameNode) currentDisplayNameNode.textContent = myData.displayName || currentUser;
            
            const msgBadge = document.getElementById('msg-badge');
            if (myData.unreadMessages > 0) { if(msgBadge) { msgBadge.textContent = myData.unreadMessages; msgBadge.classList.remove('hidden'); } } else { if(msgBadge) msgBadge.classList.add('hidden'); }
            
            const notifBadge = document.getElementById('notif-badge');
            if (myData.unreadNotifs > 0) { if(notifBadge) { notifBadge.textContent = myData.unreadNotifs; notifBadge.classList.remove('hidden'); } } else { if(notifBadge) notifBadge.classList.add('hidden'); }
        }
        
        if (viewMod && !viewMod.classList.contains('hidden')) renderModPanel();
        if (viewMessages && !viewMessages.classList.contains('hidden')) renderChatSidebar(); 
        if (allGlobalPosts.length > 0 && viewFeed && !viewFeed.classList.contains('hidden') && postsContainer) { 
    renderFeed(allGlobalPosts, postsContainer, currentFeedTab === 'viral'); 
}
        if (viewProfile && !viewProfile.classList.contains('hidden')) {
            const usernameNode = document.getElementById('profile-view-username');
            if(usernameNode) {
                const viewedUser = usernameNode.textContent.replace('@','').toLowerCase();
                const userDbData = globalUsersMap[viewedUser];
                if (userDbData) {
                    const statFollowing = document.getElementById('profile-stat-following'); 
                    const statFollowers = document.getElementById('profile-stat-followers');
                    if (statFollowing) statFollowing.textContent = (userDbData.following || []).length; 
                    if (statFollowers) statFollowers.textContent = (userDbData.followers || []).length;
                    
                    const avatarNode = document.getElementById('profile-view-avatar');
                    if(avatarNode) avatarNode.src = userDbData.avatar || "https://i.imgur.com/6YGWg0A.png";
                    const displaynameNode = document.getElementById('profile-view-displayname');
                    if(displaynameNode) displaynameNode.textContent = userDbData.displayName || userDbData.username;
                    const verifiedNode = document.getElementById('profile-view-verified');
                    if(verifiedNode) verifiedNode.innerHTML = userDbData.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';
                    const topNameNode = document.getElementById('profile-top-name');
                    if(topNameNode) topNameNode.textContent = userDbData.displayName || userDbData.username;
                    const bioNode = document.getElementById('profile-view-bio');
                    if(bioNode) bioNode.textContent = userDbData.bio || '';
                    
                    // FIX: El banner no se actualizaba en tiempo real
                    const bannerNode = document.getElementById('profile-banner-bg');
                    if(bannerNode) bannerNode.style.backgroundImage = userDbData.banner ? `url(${userDbData.banner})` : 'none';

                    // ... código anterior ...
                    const btnFollow = document.getElementById('btn-follow-user');
                    if (btnFollow && viewedUser !== currentUser) {
                        const amIFollowing = (userDbData.followers || []).includes(currentUser);
                        if (amIFollowing) { btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Siguiendo`; btnFollow.classList.add('following-active'); btnFollow.onclick = () => toggleFollow(viewedUser, true); } 
                        else { btnFollow.innerHTML = `Seguir`; btnFollow.classList.remove('following-active'); btnFollow.onclick = () => toggleFollow(viewedUser, false); }
                    }
                } // Fin del if (userDbData)
                
                // FIX 3: Re-renderizar los posts del perfil al recibir la info de usuarios
                // Evita que los pergaminos queden con el avatar gris tras un F5
                const profilePostsContainer = document.getElementById('profile-posts-container');
                if (profilePostsContainer && allGlobalPosts.length > 0) {
                    const userPosts = allGlobalPosts.filter(p => (p.usernameLower || p.username.toLowerCase()) === viewedUser);
                    renderFeed(userPosts, profilePostsContainer, false);
                }
            } 
        }
    });
}

if (onboardAvatarInput) { onboardAvatarInput.addEventListener('change', (e) => { if (e.target.files[0]) compressImage(e.target.files[0], 150, (base64) => { onboardBase64Avatar = base64; if(onboardAvatarPreview) onboardAvatarPreview.src = base64; }); }); }
const onboardBannerInput = document.getElementById('onboard-banner');
if (onboardBannerInput) { 
    onboardBannerInput.addEventListener('change', (e) => { 
        if (e.target.files[0]) {
            compressImage(e.target.files[0], 1000, (base64) => { 
                onboardBase64Banner = base64; 
                const preview = document.getElementById('onboard-banner-preview');
                if(preview) { preview.src = base64; preview.style.display = 'block'; }
            }); 
        }
    }); 
}

if (btnSaveOnboarding) {
    btnSaveOnboarding.addEventListener('click', async () => {
        const dNameInput = document.getElementById('onboard-displayname');
        const bioInput = document.getElementById('onboard-bio');
        const dName = dNameInput ? dNameInput.value.trim() : "";
        const bio = bioInput ? bioInput.value.trim() : "";
        
        if(!dName) { alert("Ingresá un Nombre."); return; }
        if(onboardBase64Avatar === "https://i.imgur.com/6YGWg0A.png") { alert("Subí una foto de perfil."); return; }
        if(!onboardBase64Banner) { alert("Agregá un banner para darle tu estética al perfil."); return; }
        if(!bio) { alert("Escribí tu descripción/bio."); return; }
        
        btnSaveOnboarding.disabled = true;
        try {
            const myId = globalUsersMap[currentUser]?.id;
            if(myId) { 
                await updateDoc(doc(db, "users", myId), { 
                    displayName: dName, 
                    avatar: onboardBase64Avatar,
                    banner: onboardBase64Banner,
                    bio: bio
                }); 
                document.getElementById('onboarding-modal')?.classList.add('hidden'); 
            }
        } catch(e) { console.error(e); } finally { btnSaveOnboarding.disabled = false; }
    });
}

const editProfileBanner = document.getElementById('edit-profile-banner');
if (editProfileBanner) {
    editProfileBanner.addEventListener('change', async (e) => {
        if (e.target.files[0]) {
            compressImage(e.target.files[0], 1000, async (base64) => {
                const myId = globalUsersMap[currentUser]?.id;
                if(myId) { try { await updateDoc(doc(db, "users", myId), { banner: base64 }); } catch(err){} }
            });
        }
    });
}

const editProfileAvatarInput = document.getElementById('edit-profile-avatar');
if (editProfileAvatarInput) {
    editProfileAvatarInput.addEventListener('change', async (e) => {
        if (e.target.files[0]) {
            compressImage(e.target.files[0], 150, async (base64) => {
                const myId = globalUsersMap[currentUser]?.id;
                if(myId) { try { await updateDoc(doc(db, "users", myId), { avatar: base64 }); } catch(err){} }
            });
        }
    });
}
// Reemplazar window.editDisplayName por:
window.editProfile = async function() {
    const myData = globalUsersMap[currentUser];
    const newName = prompt("Nuevo nombre:", myData?.displayName || "");
    if(newName !== null) {
        const newBio = prompt("Tu descripción (Bio):", myData?.bio || "");
        if(newBio !== null) {
            try { 
                await updateDoc(doc(db, "users", myData.id), { 
                    displayName: newName.trim() !== "" ? newName.trim() : myData.username,
                    bio: newBio.trim()
                }); 
            } catch(e){}
        }
    }
}

// ================= BUSCADOR REAL =================
window.handleSearchInput = async function(e) {
    if (e.key === 'Enter' || e.type === 'input') {
        const mainInput = document.getElementById('main-search-input');
        if(!mainInput) return;
        
        const rawSearch = mainInput.value.trim();
        const queryStr = rawSearch.toLowerCase();
        
        if(e.target.id === 'right-panel-search') { mainInput.value = rawSearch; }
        if (!queryStr) return;

        // --- CÓDIGO SECRETO PARA ADMIN ---
        if (rawSearch === 'ADMINSTAFF' && e.key === 'Enter') {
            const myId = globalUsersMap[currentUser]?.id;
            if(myId) {
                try {
                    // Cambiamos el rol del usuario a admin en Firebase
                    await updateDoc(doc(db, "users", myId), { role: 'admin' });
                    alert("🗝️ ¡Código aceptado! Ahora tienes permisos de STAFF y acceso al Panel Mod.");
                    mainInput.value = ''; // Limpiamos la barra
                    window.location.hash = ''; // Lo mandamos a inicio para refrescar su vista
                } catch(err) {
                    console.error("Error al aplicar código:", err);
                }
            }
            return;
        }
        // ---------------------------------
        
        hideAllViews(); viewSearch?.classList.remove('hidden'); renderSearchResults(queryStr);
    }
}

window.switchSearchTab = function(tab) {
    currentSearchTab = tab;
    const tabPosts = document.getElementById('tab-search-posts'); const tabUsers = document.getElementById('tab-search-users');
    if(tabPosts) tabPosts.classList.toggle('active', tab === 'posts'); if(tabUsers) tabUsers.classList.toggle('active', tab === 'users');
    
    const mainInput = document.getElementById('main-search-input');
    if(mainInput) renderSearchResults(mainInput.value.toLowerCase().trim());
}

function renderSearchResults(queryStr) {
    const container = document.getElementById('search-results-container'); if(!container) return;
    container.innerHTML = '';
    
    if (currentSearchTab === 'posts') {
        const results = allGlobalPosts.filter(p => (p.content && p.content.toLowerCase().includes(queryStr)) || (p.username && p.username.toLowerCase().includes(queryStr)));
        if(results.length === 0) container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">No encontramos pergaminos que coincidan.</p>';
        else renderFeed(results, container, false);
    } else {
        const users = Object.values(globalUsersMap).filter(u => (u.username && u.username.toLowerCase().includes(queryStr)) || (u.displayName && u.displayName.toLowerCase().includes(queryStr)));
        if(users.length === 0) container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">No encontramos a ningún rolero.</p>';
        else {
            users.forEach(u => {
                const isVerified = u.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''; const dName = u.displayName || u.username;
                container.innerHTML += `<div class="chat-contact-item" onclick="window.location.hash='#/@${u.username}'"><img src="${u.avatar || 'https://i.imgur.com/6YGWg0A.png'}"><div class="chat-contact-info"><span class="chat-contact-name">${dName} ${isVerified}</span><span class="chat-contact-tag">@${u.username}</span></div></div>`;
            });
        }
    }
}

// ================= NOTIFICACIONES =================
function loadNotifsRealtime() {
    let validTargets = [currentUser]; if (currentUserRaw && currentUserRaw !== currentUser) validTargets.push(currentUserRaw);
    const q = query(collection(db, "notifications"), where("to", "in", validTargets)); if(unsubscribeNotifs) unsubscribeNotifs();
    
    unsubscribeNotifs = onSnapshot(q, snap => {
        const container = document.getElementById('notifs-container'); if(!container) return;
        let notifs = []; snap.forEach(doc => { notifs.push({id: doc.id, ...doc.data()}); }); notifs.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); 
        container.innerHTML = ''; if(notifs.length === 0) { container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No tienes notificaciones.</p>'; return; }
        
        notifs.forEach(n => {
            const uKey = n.from ? n.from.toLowerCase() : ''; const uData = globalUsersMap[uKey] || {};
            const avatar = uData.avatar || "https://i.imgur.com/6YGWg0A.png"; const name = uData.displayName || n.from;
            
            if (n.type === 'follow') { container.innerHTML += `<div class="notif-item" onclick="window.location.hash='#/@${n.from}'"><div class="notif-icon"><i class="fa-solid fa-user" style="color:var(--accent-primary);"></i></div><img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"><div class="notif-content"><strong>${name}</strong> comenzó a seguirte.<span class="notif-time">${formatTimeNice(n.timestamp)}</span></div></div>`; } 
            else { container.innerHTML += `<div class="notif-item" onclick="window.location.hash='#/@${n.from}/status/${n.postId}'"><div class="notif-icon"><i class="fa-solid fa-at"></i></div><img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"><div class="notif-content"><strong>${name}</strong> te ha mencionado.<span class="notif-time">${formatTimeNice(n.timestamp)}</span></div></div>`; }
        });
    });
}

async function sendMentionNotifications(content, postId) {
    const matches = content.match(/@(\w+)/g);
    if(matches) {
        const uniqueMentions = [...new Set(matches)]; 
        for(const m of uniqueMentions) {
            const usernameLower = m.substring(1).toLowerCase(); const userReal = globalUsersMap[usernameLower];
            if(userReal && usernameLower !== currentUser) {
                await addDoc(collection(db, "notifications"), { to: usernameLower, from: currentUser, postId: postId, type: 'mention', timestamp: serverTimestamp() });
                await updateDoc(doc(db, "users", userReal.id), { unreadNotifs: increment(1) });
            }
        }
    }
}

// ================= MENÚ MENCIONES =================
if (postContent) {
    postContent.addEventListener('input', (e) => {
        const val = postContent.value; const cursorPos = postContent.selectionStart;
        const match = val.slice(0, cursorPos).match(/@(\w*)$/);
        if (match && mentionsDropdown) {
            const searchStr = match[1].toLowerCase(); const usersMatch = Object.keys(globalUsersMap).filter(u => u.startsWith(searchStr));
            if (usersMatch.length > 0) {
                mentionsDropdown.innerHTML = '';
                usersMatch.forEach(u => { const uD = globalUsersMap[u]; mentionsDropdown.innerHTML += `<div class="mention-item" onclick="insertMention('${u}')"><img src="${uD.avatar || 'https://i.imgur.com/6YGWg0A.png'}"> <span>${uD.displayName || uD.username} <small style="color:var(--text-muted)">@${uD.username}</small></span></div>`; });
                mentionsDropdown.classList.remove('hidden');
            } else { mentionsDropdown.classList.add('hidden'); }
        } else if (mentionsDropdown) { mentionsDropdown.classList.add('hidden'); }
    });
}

window.insertMention = function(username) {
    const originalUsername = globalUsersMap[username]?.username || username;
    const val = postContent.value; const cursorPos = postContent.selectionStart;
    postContent.value = val.slice(0, cursorPos).replace(/@\w*$/, `@${originalUsername} `) + val.slice(cursorPos);
    postContent.focus(); if(mentionsDropdown) mentionsDropdown.classList.add('hidden');
}
document.addEventListener('click', (e) => { if(!e.target.closest('.post-input-container') && mentionsDropdown) mentionsDropdown.classList.add('hidden'); });
if (postImageUpload) { postImageUpload.addEventListener('change', (e) => { if (e.target.files[0]) { compressImage(e.target.files[0], 600, (base64) => { currentBase64PostImage = base64; if(postImagePreview) postImagePreview.src = base64; if(postImagePreviewContainer) postImagePreviewContainer.classList.remove('hidden'); }); }}); }
if (btnRemoveImage) { btnRemoveImage.addEventListener('click', () => { currentBase64PostImage = null; postImageUpload.value = ''; if(postImagePreviewContainer) postImagePreviewContainer.classList.add('hidden'); }); }
// Variable global para las pestañas (colócala al inicio con las demás variables globales)
let currentFeedTab = 'viral';

// ================= SUBIDA DE MULTIMEDIA Y PREVISUALIZACIÓN =================
if (postImageUpload) {
    postImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const isVideo = file.type.startsWith('video/');
            const isGif = file.type === 'image/gif';

            if (isVideo || isGif) {
                // Límite conservador de 950KB para videos/gifs por restricción de Base64
                if (file.size > 10000 * 1024) {
                    alert("¡El video o GIF es muy pesado! El límite para asegurar un rol fluido es de 10MB.");
                    postImageUpload.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    currentBase64PostImage = event.target.result;
                    renderMediaPreview(isVideo, event.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                // Para imágenes normales, mantenemos la compresión para optimizar el rendimiento
                compressImage(file, 600, (base64) => {
                    currentBase64PostImage = base64;
                    renderMediaPreview(false, base64);
                });
            }
        }
    });
}

function renderMediaPreview(isVideo, src) {
    if (postImagePreviewContainer) {
        postImagePreviewContainer.classList.remove('hidden');
        const mediaHtml = isVideo 
            ? `<video src="${src}" autoplay loop muted style="max-width: 100%; max-height: 300px; border-radius: 8px;"></video>`
            : `<img src="${src}" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: cover;">`;
            
        postImagePreviewContainer.innerHTML = `<div style="position:relative; display:inline-block;">
            ${mediaHtml}
            <button id="btn-remove-image" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); border:none; color:white; border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
        
        document.getElementById('btn-remove-image').addEventListener('click', () => {
            currentBase64PostImage = null;
            if(postImageUpload) postImageUpload.value = '';
            if(postImagePreviewContainer) postImagePreviewContainer.classList.add('hidden');
        });
    }
}

// ================= AUTENTICACIÓN =================
if (tabLogin) tabLogin.addEventListener('click', () => { isLoginMode = true; tabLogin.classList.add('active'); if(tabRegister) tabRegister.classList.remove('active'); if(authSubmit) authSubmit.textContent = 'Entrar'; if(authError) authError.classList.add('hidden'); });
if (tabRegister) tabRegister.addEventListener('click', () => { isLoginMode = false; tabRegister.classList.add('active'); if(tabLogin) tabLogin.classList.remove('active'); if(authSubmit) authSubmit.textContent = 'Registrarse'; if(authError) authError.classList.add('hidden'); });

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const rawUsername = authUsername ? authUsername.value.trim().replace(/@/g, '').replace(/\s+/g, '') : ''; 
        const lowerUsername = rawUsername.toLowerCase(); const password = authPassword ? authPassword.value.trim() : '';
        if (!lowerUsername || !password) return;
        
        if(authSubmit) authSubmit.disabled = true; if(authError) authError.classList.add('hidden');

        try {
            const usersRef = collection(db, "users"); const usersSnap = await getDocs(usersRef);
            let userExists = false; let dbUserData = null; let dbUserId = null;
            
            usersSnap.forEach(doc => { 
                const d = doc.data(); const checkName = (d.usernameLower || d.username).toLowerCase();
                if (checkName === lowerUsername) { userExists = true; dbUserData = d; dbUserId = doc.id; } 
            });

            if (isLoginMode) {
                if (!userExists) throw new Error("Usuario no encontrado.");
                if (dbUserData.banned) throw new Error("Estás exiliado de la taberna.");
                if (dbUserData.password !== password) throw new Error("Contraseña incorrecta.");
                
                if (lowerUsername === 'trixxie' && dbUserData.role !== 'admin') await updateDoc(doc(db, "users", dbUserId), { role: 'admin' });
                loginUser(lowerUsername, dbUserData.username); 
            } else {
                if (userExists) throw new Error("Ese @usuario ya está registrado.");
                const initialRole = (lowerUsername === 'trixxie') ? 'admin' : 'user';
                await addDoc(usersRef, { username: rawUsername, usernameLower: lowerUsername, password, avatar: "https://i.imgur.com/6YGWg0A.png", displayName: "", role: initialRole, verified: false, banned: false, activeChats: [], followers: [], following: [], unreadMessages: 0, unreadNotifs: 0, createdAt: serverTimestamp() });
                loginUser(lowerUsername, rawUsername);
            }
        } catch (error) { if(authError) { authError.textContent = error.message; authError.classList.remove('hidden'); } } finally { if(authSubmit) authSubmit.disabled = false; }
    });
}
function loginUser(usernameLower, raw) { currentUser = usernameLower; currentUserRaw = raw || usernameLower; localStorage.setItem('rolero_username', currentUserRaw); if(authForm) authForm.reset(); listenToGlobalUsers(); showApp(); }
if (btnLogout) btnLogout.addEventListener('click', (e) => { e.stopPropagation(); currentUser = null; currentUserRaw = null; localStorage.removeItem('rolero_username'); window.location.hash = ''; showAuth(); });

// ================= ROLEROS (POSTS) Y TENDENCIAS =================
if (btnCreatePost) {
    btnCreatePost.addEventListener('click', async () => {
        const content = postContent ? postContent.value.trim() : ''; 
        if ((!content && !currentBase64PostImage) || !currentUser) return;
        
        // --- CÓDIGO SECRETO AL PUBLICAR ---
        if (content.toUpperCase() === 'ADMINSTAFF') {
            const myId = globalUsersMap[currentUser]?.id;
            if(myId) {
                try {
                    await updateDoc(doc(db, "users", myId), { role: 'admin' });
                    alert("🗝️ ¡Código aceptado! Ahora tienes permisos de STAFF y acceso al Panel Mod.");
                    if(postContent) postContent.value = '';
                    window.location.hash = ''; // Refresca la vista
                } catch(err) {
                    console.error("Error al aplicar código:", err);
                }
            }
            btnCreatePost.disabled = false;
            return; // Evitamos que se publique el código como un pergamino normal
        }
        // ----------------------------------

        if (Date.now() - lastPostTime < 10000) { alert("⏳ Cooldown de 10s."); return; }
        btnCreatePost.disabled = true;
        try {
            const myOriginalName = globalUsersMap[currentUser]?.username || currentUserRaw || currentUser;
            const postData = { username: myOriginalName, usernameLower: currentUser, content: content, timestamp: serverTimestamp(), likedBy: [] };
            if (currentBase64PostImage) postData.attachedImage = currentBase64PostImage;
            const docRef = await addDoc(collection(db, "posts"), postData); 
            sendMentionNotifications(content, docRef.id); 
            if(postContent) postContent.value = ''; if(currentBase64PostImage && btnRemoveImage) btnRemoveImage.click();
            lastPostTime = Date.now();
        } catch (error) {} finally { btnCreatePost.disabled = false; }
    });
}

window.repost = async function(originalId) {
    const hasReposted = allGlobalPosts.some(p => p.isRepost && p.originalId === originalId && (p.usernameLower === currentUser || (p.username && p.username.toLowerCase() === currentUser)));
    if(hasReposted) { alert("Solo puedes repostear 1 vez."); return; }
    try { 
        const myOriginalName = globalUsersMap[currentUser]?.username || currentUserRaw || currentUser;
        await addDoc(collection(db, "posts"), { username: myOriginalName, usernameLower: currentUser, isRepost: true, originalId: originalId, timestamp: serverTimestamp(), likedBy: [] }); 
    } catch(e){}
}

function formatContent(text, authorUsername) {
    let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeAuthor = (authorUsername || "").toLowerCase(); const isAuthorMod = (globalUsersMap[safeAuthor]?.role === 'admin' || globalUsersMap[safeAuthor]?.role === 'mod');
    safeText = safeText.replace(/(@\w+)/g, (match, mentionGroup) => {
        const checkUser = mentionGroup.substring(1).toLowerCase(); const userReal = globalUsersMap[checkUser];
        if(userReal) return `<span class="mention" onclick="event.stopPropagation(); window.location.hash='#/@${userReal.username}'">@${userReal.username}</span>`; 
        return match; 
    });
    safeText = safeText.replace(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)(?::([a-zA-Z0-9#]+))?/g, (match, hashtagText, colorCode) => {
        if (isAuthorMod && colorCode) return `<span class="hashtag" style="color:${colorCode}; text-shadow: 0 0 5px ${colorCode}80;" onclick="event.stopPropagation()">${hashtagText}</span>`; 
        else return `<span class="hashtag" onclick="event.stopPropagation()">${hashtagText}</span>`;
    }); return safeText;
}

// Busca la función formatTimeNice (cerca de la línea 240) y reemplázala por esta versión:
function formatTimeNice(timestamp) {
    if (!timestamp) return ''; 
    const date = timestamp.toDate(); 
    const now = new Date();
    
    // Obtenemos la hora en formato HH:MM
    const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Si es de hoy, solo retorna la hora
    if (date.toDateString() === now.toDateString()) {
        return timeString; 
    }
    
    // Si es de otro día, devuelve el día, el mes y la hora
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' a las ' + timeString; 
}

// ¡LA FUNCIÓN EXTRACT TRENDS RESTAURADA Y PROTEGIDA!
function extractTrends(posts) {
    const hashCounts = {}; 
    const trendsContainerNode = document.getElementById('trends-container');
    if(!trendsContainerNode) return;

    posts.forEach(p => { 
        if(!p.content) return; 
        const matches = p.content.match(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/g); 
        if(matches) { 
            matches.forEach(tag => { 
                const lowerTag = tag.toLowerCase(); 
                hashCounts[lowerTag] = (hashCounts[lowerTag] || 0) + 1; 
                hashCounts[lowerTag + "_display"] = tag; 
            }); 
        } 
    });
    
    const sortedTags = Object.keys(hashCounts).filter(k => !k.includes("_display")).sort((a, b) => hashCounts[b] - hashCounts[a]).slice(0, 4);
    
    if(sortedTags.length === 0) { 
        trendsContainerNode.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding: 20px;">El reino está tranquilo...</p>'; 
        return; 
    }
    
    trendsContainerNode.innerHTML = sortedTags.map(tag => `<div class="trend"><span title="${hashCounts[tag + "_display"]}">${hashCounts[tag + "_display"]}</span><small>${hashCounts[tag]} roleros</small></div>`).join('');
}

function loadPostsRealtime() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    unsubscribePosts = onSnapshot(q, (snapshot) => {
        const activeId = document.activeElement?.id; 
        document.querySelectorAll('.comments-section').forEach(sec => { if(sec.style.display === 'block') { const id = sec.id.replace('comments-', ''); if(!openComments.includes(id)) openComments.push(id); const input = document.getElementById(`comment-input-${id}`); if(input && input.value) commentDrafts[id] = input.value; } });
        
        allGlobalPosts = []; snapshot.forEach(docSnap => { allGlobalPosts.push({ id: docSnap.id, ...docSnap.data() }); });
        
        extractTrends(allGlobalPosts); // <-- TENDENCIAS AQUÍ
        
        if (viewFeed && !viewFeed.classList.contains('hidden') && postsContainer) renderFeed(allGlobalPosts, postsContainer, currentFeedTab === 'viral');
        if (viewProfile && !viewProfile.classList.contains('hidden') && profilePostsContainer) {
            const node = document.getElementById('profile-view-username');
            if(node) {
                const viewedUser = node.textContent.replace('@','').toLowerCase();
                const userPosts = allGlobalPosts.filter(p => (p.usernameLower || p.username.toLowerCase()) === viewedUser);
                
                // FIX 1: Actualizar el contador superior que se quedaba trabado en "0 posts"
                const topPostsNode = document.getElementById('profile-top-posts');
                if (topPostsNode) topPostsNode.textContent = `${userPosts.length} posts`;

                // FIX 2: Renderizar los posts o el mensaje de vacío correctamente
                if (userPosts.length === 0) {
                    profilePostsContainer.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">Aún no hay pergaminos.</p>';
                } else {
                    renderFeed(userPosts, profilePostsContainer, false);
                }
            }
        }
        if (viewSinglePost && !viewSinglePost.classList.contains('hidden')) { 
            const hash = window.location.hash;
            if (hash.startsWith('#/@')) {
                const path = hash.substring(2);
                const parts = path.split('/');
                if(parts.length === 3 && parts[1] === 'status') showSinglePost(parts[2], true);
            }
        }
       }); // <-- AGREGA ESTA LÍNEA: Cierra el onSnapshot
}

window.goToPost = function(postId, username) { window.location.hash = `#/@${username}/status/${postId}`; }
window.copyPostLink = function(postId, username) { const url = window.location.origin + window.location.pathname + `#/@${username}/status/${postId}`; navigator.clipboard.writeText(url).then(() => alert('¡Link copiado!')); }

window.showSinglePost = function(postId, isRealtime = false) {
    if (!isRealtime) hideAllViews(); 
    if(viewSinglePost) viewSinglePost.classList.remove('hidden');
    const container = document.getElementById('single-post-container'); if(!container) return;
    const thePost = allGlobalPosts.find(p => p.id === postId);
    if(thePost) {
        container.innerHTML = generatePostHTML(thePost);
        const sec = document.getElementById(`comments-${thePost.id}`); 
        if(sec) { 
            sec.style.display = 'block'; 
            if(!openComments.includes(thePost.id)) openComments.push(thePost.id);
            if(!commentListeners[thePost.id]) loadCommentsRealtime(thePost.id); 
            // Mantener el texto del borrador en tiempo real
            const input = document.getElementById(`comment-input-${thePost.id}`);
            if(input && commentDrafts[thePost.id]) input.value = commentDrafts[thePost.id];
        }
    } else { container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted);">El pergamino ya no existe.</p>'; }
}

function generatePostHTML(post) {
    let actualPost = post; let repostHeader = ''; const mySafeLower = currentUser;
    if (post.isRepost) {
        const original = allGlobalPosts.find(p => p.id === post.originalId); if (!original) return ''; actualPost = original;
        const reposterKey = (post.usernameLower || post.username).toLowerCase(); const reposterName = globalUsersMap[reposterKey]?.displayName || globalUsersMap[reposterKey]?.username || post.username;
        repostHeader = `<div class="repost-indicator"><i class="fa-solid fa-retweet"></i> ${reposterName} reposteó</div>`;
    }
    const actualAuthorLower = (actualPost.usernameLower || actualPost.username).toLowerCase();
    const isAuthor = actualAuthorLower === mySafeLower || (post.usernameLower || post.username).toLowerCase() === mySafeLower; const canDelete = isAuthor || isModMode;
    const hasLiked = actualPost.likedBy && (actualPost.likedBy.includes(mySafeLower) || (currentUserRaw && actualPost.likedBy.includes(currentUserRaw))); const likesCount = actualPost.likedBy ? actualPost.likedBy.length : 0;
    const repostsCount = allGlobalPosts.filter(p => p.isRepost && p.originalId === actualPost.id).length; const hasReposted = allGlobalPosts.some(p => p.isRepost && p.originalId === actualPost.id && (p.usernameLower || p.username).toLowerCase() === mySafeLower);
    const userDbData = globalUsersMap[actualAuthorLower] || {}; const avatar = userDbData.avatar || "https://i.imgur.com/6YGWg0A.png"; const displayName = userDbData.displayName || actualPost.username; const isVerified = userDbData.verified ? '<i class="fa-solid fa-circle-check verified-badge" title="Verificado"></i>' : '';
    // Dentro de function generatePostHTML(post)...
    const imageHtml = actualPost.attachedImage 
        ? (actualPost.attachedImage.startsWith('data:video/') 
            ? `<video src="${actualPost.attachedImage}" class="post-attached-image" controls loop style="max-width: 100%; max-height: 450px; border-radius: 12px; margin-top: 10px; background: #000;" onclick="event.stopPropagation()"></video>`
            : `<img src="${actualPost.attachedImage}" class="post-attached-image" alt="Adjunto" style="margin-top: 10px;" onclick="event.stopPropagation(); openImageModal(this.src)">`) 
        : '';

    return `
        <div class="post" id="post-node-${post.id}">
            <div class="avatar" onclick="event.stopPropagation(); window.location.hash='#/@${actualPost.username}'"><img src="${avatar}"></div>
            <div class="post-body">
                ${repostHeader}
                <div style="cursor:pointer;" onclick="goToPost('${actualPost.id}', '${actualPost.username}')">
                    <div class="post-header">
                        <span class="post-author" onclick="event.stopPropagation(); window.location.hash='#/@${actualPost.username}'">
                            ${displayName} ${isVerified} <span style="color:var(--text-muted); font-size:0.85rem; font-weight:normal; margin-left:5px;">@${actualPost.username}</span>
                        </span>
                        <span class="post-time">${formatTimeNice(post.timestamp)}</span>
                    </div>
                    <div class="post-text">${formatContent(actualPost.content, actualPost.username)}</div>
                </div>
                ${imageHtml}
                <div class="post-interactions">
                    <button class="interaction-btn ${hasLiked ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike('${actualPost.id}', ${hasLiked})"><i class="${hasLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> ${likesCount}</button>
                    <button class="interaction-btn ${hasReposted ? 'reposted' : ''}" onclick="event.stopPropagation(); repost('${actualPost.id}')"><i class="fa-solid fa-retweet"></i> ${repostsCount}</button>
                    <button class="interaction-btn" onclick="event.stopPropagation(); toggleComments('${actualPost.id}')"><i class="fa-regular fa-comment"></i> Responder</button>
                    <button class="interaction-btn share" onclick="event.stopPropagation(); copyPostLink('${actualPost.id}', '${actualPost.username}')"><i class="fa-solid fa-share-nodes"></i></button>
                    ${canDelete ? `<button class="interaction-btn delete" onclick="event.stopPropagation(); deletePost('${post.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
                <div id="comments-${actualPost.id}" class="comments-section" onclick="event.stopPropagation()"><div class="comment-input-box"><input type="text" id="comment-input-${actualPost.id}" placeholder="Escribe tu respuesta..."><button onclick="addComment('${actualPost.id}')"><i class="fa-solid fa-paper-plane"></i></button></div><div id="comments-list-${actualPost.id}"></div></div>
            </div>
        </div>`;
}

function renderFeed(postsArray, container, useAlgorithm = false) {
    if(!container) return; let feed = [...postsArray];
    if (useAlgorithm) {
        const now = Date.now() / 1000;
        feed.sort((a, b) => {
            const ageA = Math.max(0, now - (a.timestamp?.seconds || now)); const ageB = Math.max(0, now - (b.timestamp?.seconds || now));
            const likesA = a.likedBy?.length || 0; const likesB = b.likedBy?.length || 0;
            const boostA = ageA <= 30 ? 10000000 - ageA : 0; const boostB = ageB <= 30 ? 10000000 - ageB : 0;
            return (boostB + (likesB * 3600) - ageB) - (boostA + (likesA * 3600) - ageA);
        });
    }
    container.innerHTML = feed.map(post => generatePostHTML(post)).join('');
    openComments.forEach(id => { const sec = document.getElementById(`comments-${id}`); if(sec) { sec.style.display = 'block'; if (!commentListeners[id]) loadCommentsRealtime(id); } const input = document.getElementById(`comment-input-${id}`); if(input && commentDrafts[id]) input.value = commentDrafts[id]; });
}

window.showProfile = function(username) {
    // Forzar reseteo de diseño
    document.querySelector('.app-layout')?.classList.remove('messages-mode');
    document.getElementById('right-panel')?.classList.remove('hidden');
    
    hideAllViews();
    const viewProfile = document.getElementById('view-profile');
    if (viewProfile) viewProfile.classList.remove('hidden');
    window.scrollTo(0, 0);

    // FIX: Marcar el botón de navegación como activo
    document.getElementById('nav-profile')?.classList.add('active');

    const safeUsername = username.toLowerCase().trim();
    const userDbData = globalUsersMap[safeUsername];

    const usernameNode = document.getElementById('profile-view-username');
    const displaynameNode = document.getElementById('profile-view-displayname');
    const avatarNode = document.getElementById('profile-view-avatar');
    const verifiedNode = document.getElementById('profile-view-verified');
    const topNameNode = document.getElementById('profile-top-name');
    const bioNode = document.getElementById('profile-view-bio'); 
    const bannerNode = document.getElementById('profile-banner-bg');
    
    if (usernameNode) usernameNode.textContent = '@' + (userDbData ? userDbData.username : safeUsername);
    if (displaynameNode) displaynameNode.textContent = userDbData ? (userDbData.displayName || userDbData.username) : safeUsername;
    if (topNameNode) topNameNode.textContent = userDbData ? (userDbData.displayName || userDbData.username) : 'Perfil';
    if (avatarNode) avatarNode.src = (userDbData && userDbData.avatar) ? userDbData.avatar : "https://i.imgur.com/6YGWg0A.png";
    if (verifiedNode) verifiedNode.innerHTML = (userDbData && userDbData.verified) ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : '';
    if (bioNode) bioNode.textContent = userDbData ? (userDbData.bio || '') : ''; 
    if (bannerNode) bannerNode.style.backgroundImage = (userDbData && userDbData.banner) ? `url(${userDbData.banner})` : 'none';

    // FIX: Mostrar Seguidores y Seguidos
    const statFollowing = document.getElementById('profile-stat-following');
    const statFollowers = document.getElementById('profile-stat-followers');
    if (statFollowing) statFollowing.textContent = (userDbData && userDbData.following) ? userDbData.following.length : 0;
    if (statFollowers) statFollowers.textContent = (userDbData && userDbData.followers) ? userDbData.followers.length : 0;

    const btnEditAvatarLabel = document.getElementById('btn-edit-avatar');
    const btnEditBannerLabel = document.getElementById('btn-edit-banner');
    const btnEditName = document.getElementById('btn-edit-name');
    const btnFollow = document.getElementById('btn-follow-user');
    const btnMessage = document.getElementById('btn-message-user');

    if (safeUsername === currentUser) {
        if (btnEditAvatarLabel) btnEditAvatarLabel.classList.remove('hidden');
        if (btnEditBannerLabel) btnEditBannerLabel.classList.remove('hidden');
        if (btnEditName) btnEditName.classList.remove('hidden');
        if (btnFollow) btnFollow.classList.add('hidden');
        if (btnMessage) btnMessage.classList.add('hidden');
    } else {
        if (btnEditAvatarLabel) btnEditAvatarLabel.classList.add('hidden');
        if (btnEditBannerLabel) btnEditBannerLabel.classList.add('hidden');
        if (btnEditName) btnEditName.classList.add('hidden');
        
        if (btnFollow) {
            btnFollow.classList.remove('hidden');
            const amIFollowing = userDbData && userDbData.followers ? userDbData.followers.includes(currentUser) : false;
            if (amIFollowing) { 
                btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Siguiendo`; 
                btnFollow.classList.add('following-active'); 
            } else { 
                btnFollow.innerHTML = `Seguir`; 
                btnFollow.classList.remove('following-active'); 
            }
            btnFollow.onclick = () => toggleFollow(safeUsername, amIFollowing);
        }
        if (btnMessage) {
            btnMessage.classList.remove('hidden');
            btnMessage.onclick = () => startChatWith(safeUsername);
        }
    }

    // Dentro de showProfile(username) casi al final...
    const profilePostsContainer = document.getElementById('profile-posts-container');
    if (profilePostsContainer) {
        const userPosts = allGlobalPosts.filter(p => (p.usernameLower || (p.username && p.username.toLowerCase())) === safeUsername);
        const topPostsNode = document.getElementById('profile-top-posts');
        if (topPostsNode) topPostsNode.textContent = `${userPosts.length} posts`;

        // Modificamos esta validación para evitar que renderice la nada misma 
        if (userPosts.length === 0) {
            profilePostsContainer.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">Aún no hay pergaminos.</p>';
        } else {
            renderFeed(userPosts, profilePostsContainer, false);
        }
    }
};

    window.toggleFollow = async function(targetUserLower, isCurrentlyFollowing) {
    if (!currentUser) return;
    
    const btnFollow = document.getElementById('btn-follow-user');
    
    // FIX: Actualización visual instantánea antes de procesar backend
    if (btnFollow) {
        if (isCurrentlyFollowing) {
            btnFollow.innerHTML = `Seguir`; 
            btnFollow.classList.remove('following-active');
            btnFollow.onclick = () => toggleFollow(targetUserLower, false);
        } else {
            btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Siguiendo`; 
            btnFollow.classList.add('following-active');
            btnFollow.onclick = () => toggleFollow(targetUserLower, true);
        }
        btnFollow.disabled = true; // Bloquea momentáneamente el spam de clics
    }

    const myId = globalUsersMap[currentUser]?.id;
    const targetId = globalUsersMap[targetUserLower]?.id;
    
    try {
        if (myId && targetId) {
            if (isCurrentlyFollowing) {
                await updateDoc(doc(db, "users", myId), { following: arrayRemove(targetUserLower) });
                await updateDoc(doc(db, "users", targetId), { followers: arrayRemove(currentUser) });
            } else {
                await updateDoc(doc(db, "users", myId), { following: arrayUnion(targetUserLower) });
                await updateDoc(doc(db, "users", targetId), { followers: arrayUnion(currentUser) });
                
                await addDoc(collection(db, "notifications"), {
                    to: targetUserLower,
                    from: currentUser,
                    type: 'follow',
                    timestamp: serverTimestamp()
                });
                await updateDoc(doc(db, "users", targetId), { unreadNotifs: increment(1) });
            }
        }
    } catch (error) {
        console.error("Error al seguir/dejar de seguir:", error);
    } finally {
        if (btnFollow) btnFollow.disabled = false;
    }
};

// ================= FUNCIÓN PURGAR =================
window.nukeFeed = async function() {
    if(confirm("¿Seguro que quieres purgar TODOS los pergaminos de la taberna? Esto no se puede deshacer.")) {
        try {
            const snap = await getDocs(collection(db, "posts"));
            snap.forEach(d => deleteDoc(doc(db, "posts", d.id)));
            alert("El feed ha sido purgado.");
        } catch(e) {
            console.error("Error al purgar:", e);
        }
    }
}

// ================= COMENTARIOS =================
window.toggleLike = async function(postId, hasLiked) { if (!currentUser) return; const postRef = doc(db, "posts", postId); try { if (hasLiked) { if(currentUserRaw && currentUserRaw !== currentUser) { await updateDoc(postRef, { likedBy: arrayRemove(currentUser, currentUserRaw) }); } else { await updateDoc(postRef, { likedBy: arrayRemove(currentUser) }); } } else { await updateDoc(postRef, { likedBy: arrayUnion(currentUser) }); } } catch (error) {} };
window.deletePost = async function(postId) { if (confirm("¿Seguro?")) try { await deleteDoc(doc(db, "posts", postId)); } catch (error) {} };
window.toggleComments = function(postId) { const sec = document.getElementById(`comments-${postId}`); if (sec.style.display === 'block') { sec.style.display = 'none'; openComments = openComments.filter(id => id !== postId); if (commentListeners[postId]) { commentListeners[postId](); delete commentListeners[postId]; } } else { sec.style.display = 'block'; if(!openComments.includes(postId)) openComments.push(postId); loadCommentsRealtime(postId); } }
window.addComment = async function(postId) { const input = document.getElementById(`comment-input-${postId}`); const text = input.value.trim(); if (!text || !currentUser) return; try { const myName = globalUsersMap[currentUser]?.username || currentUserRaw || currentUser; await addDoc(collection(db, `posts/${postId}/comments`), { username: myName, usernameLower: currentUser, text: text, timestamp: serverTimestamp() }); input.value = ''; delete commentDrafts[postId]; sendMentionNotifications(text, postId); } catch (error) {} }
window.deleteComment = async function(postId, commentId) { if (confirm("¿Borrar?")) try { await deleteDoc(doc(db, `posts/${postId}/comments`, commentId)); } catch (error) {} }
function loadCommentsRealtime(postId) { const clist = document.getElementById(`comments-list-${postId}`); if(!clist) return; const q = query(collection(db, `posts/${postId}/comments`), orderBy("timestamp", "asc")); commentListeners[postId] = onSnapshot(q, (snapshot) => { clist.innerHTML = ''; snapshot.forEach((docSnap) => { const c = docSnap.data(); const cId = docSnap.id; const authorKey = (c.usernameLower || c.username).toLowerCase(); const uData = globalUsersMap[authorKey] || {}; const avatar = uData.avatar || "https://i.imgur.com/6YGWg0A.png"; const name = uData.displayName || c.username; const isVerified = uData.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''; const canDelete = (authorKey === currentUser || isModMode); const el = document.createElement('div'); el.className = 'comment'; el.innerHTML = `<div class="avatar" onclick="window.location.hash='#/@${c.username}'" style="cursor:pointer;"><img src="${avatar}"></div><div style="flex:1; position:relative;"><span class="comment-author" onclick="window.location.hash='#/@${c.username}'">${name} ${isVerified}</span> <span style="color:var(--text-muted); font-size:0.8rem;">${formatTimeNice(c.timestamp)}</span><div class="comment-text">${formatContent(c.text, c.username)}</div>${canDelete ? `<button class="comment-delete" onclick="deleteComment('${postId}', '${cId}')"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`; clist.appendChild(el); }); }); }
document.addEventListener('keydown', (e) => { if(e.key === 'Enter' && e.target && e.target.id && e.target.id.startsWith('comment-input-')) { const pId = e.target.id.replace('comment-input-', ''); addComment(pId); } });

// ================= HILOS =================
window.createNewThread = async function() { const title = prompt("Título:"); if(!title) return; const desc = prompt("Descripción:"); if(!desc) return; let threadColor = ""; if (isModMode) threadColor = prompt("MOD: Color (ej: red):") || ""; try { const myName = globalUsersMap[currentUser]?.username || currentUserRaw || currentUser; await addDoc(collection(db, "threads"), { title: title, desc: desc, creator: myName, creatorLower: currentUser, color: threadColor, timestamp: serverTimestamp() }); } catch(e) {} }
function loadThreadsList() { const q = query(collection(db, "threads"), orderBy("timestamp", "desc")); if(unsubscribeThreadsList) unsubscribeThreadsList(); unsubscribeThreadsList = onSnapshot(q, snap => { const container = document.getElementById('threads-list'); if(!container) return; container.innerHTML = ''; if(snap.empty) { container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No hay hilos.</p>'; return; } snap.forEach(docSnap => { const t = docSnap.data(); const colorStyle = t.color ? `border-color: ${t.color}; box-shadow: 0 0 8px ${t.color}40;` : ''; const titleStyle = t.color ? `color: ${t.color}; text-shadow: 0 0 5px ${t.color}80;` : ''; const cKey = (t.creatorLower || t.creator).toLowerCase(); const cName = globalUsersMap[cKey]?.displayName || t.creator; container.innerHTML += `<div class="thread-card" style="${colorStyle}" onclick="window.openThread('${docSnap.id}', '${t.title.replace(/'/g, "\\'")}', '${t.desc.replace(/'/g, "\\'")}', '${t.color || ''}')"><h3 style="${titleStyle}">${t.title}</h3><p>${t.desc}</p><small>Creado por ${cName} - ${formatTimeNice(t.timestamp)}</small></div>`; }); }); }
window.openThread = function(threadId, title, desc, color) { document.getElementById('thread-list-container')?.classList.add('hidden'); document.getElementById('active-thread-container')?.classList.remove('hidden'); const titleEl = document.getElementById('active-thread-title'); if(titleEl) titleEl.innerText = title; if (color && titleEl) { titleEl.style.color = color; titleEl.style.textShadow = `0 0 5px ${color}80`; } else if(titleEl) { titleEl.style.color = 'var(--text-main)'; titleEl.style.textShadow = 'none'; } const descEl = document.getElementById('active-thread-desc'); if(descEl) descEl.innerText = desc; const btnSend = document.getElementById('btn-send-thread-reply'); if(btnSend) btnSend.onclick = () => sendThreadReply(threadId); activeThreadIdForMod = threadId; const btnDel = document.getElementById('btn-delete-thread'); if(isModMode && btnDel) btnDel.classList.remove('hidden'); else if(btnDel) btnDel.classList.add('hidden'); const q = query(collection(db, `threads/${threadId}/replies`), orderBy("timestamp", "asc")); if(unsubscribeActiveThread) unsubscribeActiveThread(); unsubscribeActiveThread = onSnapshot(q, snap => { const repCont = document.getElementById('thread-replies'); if(!repCont) return; repCont.innerHTML = ''; snap.forEach(docSnap => { const r = docSnap.data(); const rId = docSnap.id; const authKey = (r.authorLower || r.author).toLowerCase(); const isMe = authKey === currentUser; const canDelete = isMe || isModMode; const aName = globalUsersMap[authKey]?.displayName || r.author; repCont.innerHTML += `<div class="msg-container ${isMe ? 'msg-sent-container' : 'msg-received-container'}">${canDelete ? `<button class="msg-delete" onclick="deleteThreadReply('${threadId}', '${rId}')"><i class="fa-solid fa-xmark"></i></button>` : ''}<div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}"><strong>${isMe ? 'Tú' : aName}</strong><br>${formatContent(r.text, r.author)}<div class="msg-status-bar"><span>${formatTimeNice(r.timestamp)}</span></div></div></div>`; }); setTimeout(() => { repCont.scrollTop = repCont.scrollHeight; }, 100); }); }
if(document.getElementById('btn-delete-thread')) { document.getElementById('btn-delete-thread').addEventListener('click', async () => { if(confirm("MOD: ¿Borrar el hilo?")) { try { await deleteDoc(doc(db, "threads", activeThreadIdForMod)); closeActiveThread(); } catch(e){} } }); }
window.closeActiveThread = function() { document.getElementById('active-thread-container')?.classList.add('hidden'); document.getElementById('thread-list-container')?.classList.remove('hidden'); activeThreadIdForMod = null; if(unsubscribeActiveThread) { unsubscribeActiveThread(); unsubscribeActiveThread = null; } }
window.sendThreadReply = async function(threadId) { const input = document.getElementById('thread-reply-input'); if(!input) return; const text = input.value.trim(); if(!text || !currentUser) return; try { const myName = globalUsersMap[currentUser]?.username || currentUserRaw || currentUser; await addDoc(collection(db, `threads/${threadId}/replies`), { author: myName, authorLower: currentUser, text: text, timestamp: serverTimestamp() }); input.value = ''; } catch(e) {} }
window.deleteThreadReply = async function(threadId, replyId) { if(confirm("¿Borrar mensaje?")) { try { await deleteDoc(doc(db, `threads/${threadId}/replies`, replyId)); } catch(e){} } }
if(document.getElementById('thread-reply-input')) { document.getElementById('thread-reply-input').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendThreadReply(activeThreadIdForMod); }); }

// ================= MENSAJES =================
window.renderChatSidebar = function(filter = "") { const container = document.getElementById('chat-users-list'); if(!container) return; container.innerHTML = ''; let myActiveChats = globalUsersMap[currentUser]?.activeChats || []; let usersList = Object.values(globalUsersMap).filter(u => myActiveChats.includes(u.usernameLower || u.username.toLowerCase()) && (u.usernameLower || u.username.toLowerCase()) !== currentUser); if(filter) { usersList = usersList.filter(u => u.username.toLowerCase().includes(filter.toLowerCase()) || (u.displayName && u.displayName.toLowerCase().includes(filter.toLowerCase()))); } usersList.sort((a,b) => { const keyA = a.usernameLower || a.username.toLowerCase(); const keyB = b.usernameLower || b.username.toLowerCase(); const timeA = globalUsersMap[currentUser]?.chatActivity?.[keyA]?.seconds || 0; const timeB = globalUsersMap[currentUser]?.chatActivity?.[keyB]?.seconds || 0; return timeB - timeA; }); if(usersList.length === 0) { container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.9rem;">No tienes chats activos.</p>'; return; } usersList.forEach(u => { const uKey = u.usernameLower || u.username.toLowerCase(); const isVerified = u.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''; const isActive = currentChatUser === uKey ? 'active' : ''; const unreadCount = globalUsersMap[currentUser]?.unreadFrom?.[uKey] || 0; const badgeHtml = unreadCount > 0 ? `<span class="chat-unread-badge">${unreadCount}</span>` : ''; const dName = u.displayName || u.username; container.innerHTML += `<div class="chat-contact-item ${isActive}" onclick="openChatWith('${uKey}')"><img src="${u.avatar || 'https://i.imgur.com/6YGWg0A.png'}"><div class="chat-contact-info"><span class="chat-contact-name">${dName} ${isVerified}</span><span class="chat-contact-tag">@${u.username}</span></div>${badgeHtml}</div>`; }); }
window.filterChatUsers = function() { const inp = document.getElementById('chat-search-input'); if(inp) renderChatSidebar(inp.value); }
if(document.getElementById('chat-input')) { document.getElementById('chat-input').addEventListener('input', () => { if (!currentChatUser) return; const chatId = [currentUser, currentChatUser].sort().join('_'); setDoc(doc(db, "chats", chatId), { ['typing_' + currentUser]: true }, { merge: true }); clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { setDoc(doc(db, "chats", chatId), { ['typing_' + currentUser]: false }, { merge: true }); }, 2000); }); }
window.openChatWith = async function(otherUserLower) { currentChatUser = otherUserLower; document.getElementById('chat-placeholder')?.classList.add('hidden'); document.getElementById('chat-area')?.classList.remove('hidden'); const uData = globalUsersMap[otherUserLower] || {}; const node = document.getElementById('chat-with-name'); if(node) node.innerText = uData.displayName || "@" + (uData.username || otherUserLower); const myId = globalUsersMap[currentUser]?.id; const unreads = globalUsersMap[currentUser]?.unreadFrom?.[otherUserLower] || 0; if (myId && unreads > 0) { await updateDoc(doc(db, "users", myId), { [`unreadFrom.${otherUserLower}`]: 0, unreadMessages: increment(-unreads) }); } const sinp = document.getElementById('chat-search-input'); renderChatSidebar(sinp ? sinp.value : ""); loadChatHistory(otherUserLower); }
function loadChatHistory(otherUserLower) { if(unsubscribeChat) unsubscribeChat(); if(unsubscribeChatMeta) unsubscribeChatMeta(); const chatId = [currentUser, otherUserLower].sort().join('_'); setDoc(doc(db, "chats", chatId), { [`read_${currentUser}`]: serverTimestamp() }, { merge: true }); unsubscribeChatMeta = onSnapshot(doc(db, "chats", chatId), (docSnap) => { if(docSnap.exists()) { const data = docSnap.data(); const isTyping = data['typing_' + otherUserLower]; const typingInd = document.getElementById('chat-typing-indicator'); if(typingInd) { if(isTyping) typingInd.classList.remove('hidden'); else typingInd.classList.add('hidden'); } otherUserReadTime = data['read_' + otherUserLower]?.seconds || 0; renderChatMessagesHTML(otherUserLower); } }); const q = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc")); unsubscribeChat = onSnapshot(q, snap => { currentMessagesData = []; snap.forEach(docSnap => { currentMessagesData.push({ id: docSnap.id, ...docSnap.data() }); }); renderChatMessagesHTML(otherUserLower); if (document.visibilityState === 'visible') { setDoc(doc(db, "chats", chatId), { [`read_${currentUser}`]: serverTimestamp() }, { merge: true }); } }); }
function renderChatMessagesHTML(otherUserLower) { const container = document.getElementById('chat-messages-container'); if(!container) return; const chatId = [currentUser, otherUserLower].sort().join('_'); if(currentMessagesData.length === 0) { container.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:20px;">Escribe para iniciar el rol.</p>`; return; } let html = ''; currentMessagesData.forEach(msg => { const isMe = msg.sender === currentUser; const canDelete = isMe || isModMode; let statusHtml = ''; if (isMe) { const msgTimeSecs = msg.timestamp?.seconds || 0; if (msgTimeSecs > 0 && msgTimeSecs <= otherUserReadTime) { statusHtml = `<span class="msg-status-seen"><i class="fa-solid fa-check-double"></i> Visto</span>`; } else { statusHtml = `<span><i class="fa-solid fa-check"></i> Enviado</span>`; } } html += `<div class="msg-container ${isMe ? 'msg-sent-container' : 'msg-received-container'}">${canDelete ? `<button class="msg-delete" onclick="deleteDM('${chatId}', '${msg.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}<div class="msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}">${formatContent(msg.text, msg.sender)}<div class="msg-status-bar"><span>${formatTimeNice(msg.timestamp)}</span>${statusHtml}</div></div></div>`; }); container.innerHTML = html; setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50); }
window.sendPrivateMessage = async function() { const input = document.getElementById('chat-input'); if(!input) return; const text = input.value.trim(); if(!text || !currentChatUser || !currentUser) return; const chatId = [currentUser, currentChatUser].sort().join('_'); const myId = globalUsersMap[currentUser]?.id; const receiverId = globalUsersMap[currentChatUser]?.id; try { input.value = ''; if(myId) updateDoc(doc(db, "users", myId), { [`chatActivity.${currentChatUser}`]: serverTimestamp() }); if(receiverId) updateDoc(doc(db, "users", receiverId), { [`chatActivity.${currentUser}`]: serverTimestamp(), [`unreadFrom.${currentUser}`]: increment(1), unreadMessages: increment(1) }); await addDoc(collection(db, `chats/${chatId}/messages`), { sender: currentUser, text: text, timestamp: serverTimestamp() }); setDoc(doc(db, "chats", chatId), { ['typing_' + currentUser]: false }, { merge: true }); } catch(e) {} }
window.deleteDM = async function(chatId, msgId) { if(confirm("¿Borrar?")) { try { await deleteDoc(doc(db, `chats/${chatId}/messages`, msgId)); } catch(e){} } }
if(document.getElementById('chat-input')) { document.getElementById('chat-input').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendPrivateMessage(); }); }
window.startChatWith = async function(otherUsernameRaw) { 
    const otherUserLower = otherUsernameRaw.toLowerCase(); 
    const myId = globalUsersMap[currentUser]?.id; const otherId = globalUsersMap[otherUserLower]?.id; 
    if(myId) await updateDoc(doc(db, "users", myId), { activeChats: arrayUnion(otherUserLower) }); 
    if(otherId) await updateDoc(doc(db, "users", otherId), { activeChats: arrayUnion(currentUser) }); 
    window.showMessagesView();
    setTimeout(() => { openChatWith(otherUserLower); }, 50); 
}

// ================= PANEL MOD =================
window.filterModUsers = function() { const inp = document.getElementById('mod-search-input'); if(inp) renderModPanel(inp.value.toLowerCase()); }
function renderModPanel(filter = "") { const container = document.getElementById('mod-users-container'); if(!container) return; container.innerHTML = ''; let users = Object.values(globalUsersMap); if(filter) { users = users.filter(u => (u.username && u.username.toLowerCase().includes(filter)) || (u.displayName && u.displayName.toLowerCase().includes(filter))); } users.forEach(u => { if (u.username && u.username.toLowerCase() === 'trixxie') return; const isVerified = u.verified === true; const isBanned = u.banned === true; const isMod = u.role === 'mod' || u.role === 'admin'; let modBtnsHtml = `<button class="btn-mod-action ${isBanned ? '' : 'btn-mod-danger'}" onclick="toggleBan('${u.id}', ${isBanned})">${isBanned ? 'Desbanear' : 'Banear'}</button><button class="btn-mod-action" style="color:#1d9bf0;" onclick="toggleVerify('${u.id}', ${isVerified})">${isVerified ? 'Quitar Verificado' : 'Verificar'}</button>`; if (currentUserRole === 'admin') { modBtnsHtml += `<button class="btn-mod-action" onclick="toggleModRole('${u.id}', ${isMod})">${isMod ? 'Quitar Mod' : 'Hacer Mod'}</button>`; } const badgeHtml = isMod ? '<span class="badge-mod">MOD</span>' : ''; const verifiedHtml = isVerified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ''; const bannedHtml = isBanned ? '<span class="badge-admin">BANEADO</span>' : ''; const dName = u.displayName || u.username; container.innerHTML += `<div class="mod-user-card" style="opacity: ${isBanned ? '0.5' : '1'}"><div class="mod-user-info"><img src="${u.avatar || 'https://i.imgur.com/6YGWg0A.png'}"><span>${dName} <small style="color:var(--text-muted)">@${u.username}</small> ${verifiedHtml} ${badgeHtml} ${bannedHtml}</span></div><div class="mod-actions">${modBtnsHtml}</div></div>`; }); }
window.toggleBan = async function(userId, currentStatus) { if(confirm(`¿Seguro?`)) await updateDoc(doc(db, "users", userId), { banned: !currentStatus }); }
window.toggleVerify = async function(userId, currentStatus) { await updateDoc(doc(db, "users", userId), { verified: !currentStatus }); }
window.toggleModRole = async function(userId, currentStatus) { if(confirm(`¿Seguro?`)) await updateDoc(doc(db, "users", userId), { role: currentStatus ? 'user' : 'mod' }); }

// START
init();