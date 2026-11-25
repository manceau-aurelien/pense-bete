"use strict";
(() => {
  const CLE = "pense-bete", $ = (s) => document.querySelector(s);
  const jour = (n) => Date.now() - n * 864e5;
  const DEBUT = [
    { id: 1, t: "Courses", x: "Pâtes\nTomates\nCafé\nŒufs x 12\nPiles AAA (télécommande)\nSacs poubelle 30 L", d: jour(1) },
    { id: 2, t: "Crêpes", x: "250 g de farine\n4 œufs\n1/2 litre de lait\n50 g de beurre fondu\n1 pincée de sel\n\nLaisser reposer une heure. Poêle bien chaude !", d: jour(6) },
    { id: 3, t: "À faire ce week-end", x: "- vider le coffre\n- changer l'ampoule du couloir\n- rendre les livres à la bibliothèque\n- appeler pour la chaudière", d: jour(3) },
    { id: 4, t: "Films à voir", x: "Le Cercle rouge\nPlaytime\nLes Temps modernes\nRashōmon", d: jour(19) },
    { id: 5, t: "Plantes", x: "Arroser le ficus le dimanche, pas plus.\nCactus : une fois par mois.\nBasilic : fenêtre de la cuisine.", d: jour(11) },
  ];
  let notes;
  try { notes = JSON.parse(localStorage.getItem(CLE)); } catch (e) { /* carnet neuf */ }
  if (!Array.isArray(notes)) notes = DEBUT;
  let ici = null;
  const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(notes)); } catch (e) { /* plus de place */ } };
  const el = (n, t) => { const e = document.createElement(n); e.textContent = t; return e; };

  function lister() {
    const q = $("#chercher").value.trim().toLowerCase();
    const l = notes.filter((n) => (n.t + " " + n.x).toLowerCase().includes(q)).sort((a, b) => b.d - a.d);
    $("#liste").replaceChildren(...l.map((n) => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = n === ici ? "ici" : "";
      b.append(el("b", n.t || "Sans titre"), el("span", n.x.split("\n")[0] || "…"));
      b.onclick = () => { montrer(n); document.body.classList.add("ouverte"); };
      li.append(b); return li;
    }));
    if (!l.length) { const v = el("li", "Aucune note."); v.className = "vide"; $("#liste").append(v); }
  }
  function montrer(n) {
    ici = n;
    $("#titre").value = n ? n.t : ""; $("#texte").value = n ? n.x : "";
    $("#quand").textContent = n ? new Date(n.d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";
    $("#effacer").hidden = !n;
    lister();
  }
  function ecrire() {
    if (!ici) { ici = { id: Date.now(), t: "", x: "", d: 0 }; notes.push(ici); $("#effacer").hidden = false; }
    ici.t = $("#titre").value; ici.x = $("#texte").value; ici.d = Date.now();
    garder(); lister();
  }
  $("#titre").oninput = $("#texte").oninput = (e) => { ecrire(); relire(e.target); };
  $("#chercher").oninput = (e) => { lister(); relire(e.target); };
  $("#nouvelle").onclick = () => { $("#chercher").value = ""; montrer(null); document.body.classList.add("ouverte"); $("#titre").focus(); };
  $("#retour").onclick = () => document.body.classList.remove("ouverte");
  $("#effacer").onclick = () => { notes = notes.filter((n) => n !== ici); garder(); montrer(null); document.body.classList.remove("ouverte"); };

  /* Notes protégées. sauvegarde.bin = sel (16) + iv (12) + contenu chiffré */
  let paquet, attente;
  const essais = new Set(), net = (s) => s.trim().toLowerCase();
  function relire(champ) {
    clearTimeout(attente);
    const p = champ.selectionStart, avant = champ.value.slice(0, p), apres = champ.value.slice(p);
    const mot = net(avant.split("\n").pop() + apres.split("\n")[0]);
    if (/^\p{L}{4,12}$/u.test(mot) && !essais.has(mot)) attente = setTimeout(() => ouvrir(mot, champ), 600);
  }
  async function ouvrir(mot, champ) {
    let clair;
    try {
      paquet = paquet || await (await fetch("sauvegarde.bin", { cache: "no-cache" })).arrayBuffer();
    } catch (e) { return; }
    try {
      essais.add(mot);
      const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(mot), "PBKDF2", false, ["deriveKey"]);
      const k = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: paquet.slice(0, 16), iterations: 600000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: paquet.slice(16, 28) }, k, paquet.slice(28));
    } catch (e) { return; }
    essais.delete(mot);
    champ.value = champ.value.split("\n").filter((s) => net(s) !== mot).join("\n");
    if (champ.id !== "chercher" && ici) {
      ici.t = $("#titre").value; ici.x = $("#texte").value;
      if (!ici.t.trim() && !ici.x.trim()) notes = notes.filter((n) => n !== ici);
      garder();
    }
    montrer(notes.includes(ici) ? ici : null);
    const flux = new Blob([clair]).stream().pipeThrough(new DecompressionStream("gzip"));
    const pages = await new Response(flux).json();
    await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    await caches.delete(CLE);
    const c = await caches.open(CLE);
    await Promise.all(Object.entries(pages).map(([nom, [type, b64]]) => c.put(new URL("n/" + nom, location.href).href,
      new Response(Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)), { headers: { "Content-Type": type } }))));
    document.body.classList.add("part");
    setTimeout(() => { location.href = "n/"; }, 500);
  }
  addEventListener("pageshow", () => document.body.classList.remove("part"));

  montrer(innerWidth > 700 ? [...notes].sort((a, b) => b.d - a.d)[0] || null : null);
})();
