# 🎨 Design System Report - Cartoonova

## 📋 Overview
Ce document extrait le Design System complet du site Cartoonova, un site e-commerce de portraits personnalisés style cartoon/Simpsons avec une identité visuelle forte et ludique.

---

## 🎨 Palette de Couleurs

### Couleurs Principales
```css
/* Jaune primaire (brand color) */
--color-primary: #ffd23a;           /* RGB: 255, 210, 58 */
--color-primary-dark: #c39500;       /* RGB: 195, 149, 0 */

/* Couleurs secondaires */
--color-secondary: #45a6ff;         /* RGB: 69, 166, 255 - Bleu */
--color-accent: #9c3605;            /* RGB: 156, 54, 5 - Rouge brun */
--color-accent-light: #ee5208;       /* RGB: 238, 82, 8 - Rouge vif */

/* Couleurs de fond */
--color-bg: #ffffff;                 /* Blanc principal */
--color-bg-alt: #fef9e7;             /* Jaune très clair */

/* Couleurs de texte */
--color-text: #252525;               /* Noir doux */
--color-text-muted: #606c9c;         /* Gris bleuâtre */
```

### Utilisation des couleurs
- **Jaune `#ffd23a`**: Boutons principaux, accents, headers, badges
- **Noir `#000000`**: Bordures, textes principaux, ombres
- **Blanc `#ffffff`**: Fond principal, cartes, modales
- **Gris `#606c9c`**: Textes secondaires, placeholders
- **Rouge `#ee5208`**: Erreurs, badges de suppression
- **Vert `#00b67a`**: Avis clients, succès

---

## 🔤 Typographie

### Polices
```css
--font-sans: var(--font-poppins), system-ui, sans-serif;
```

- **Police principale**: Poppins (Google Fonts)
- **Poids disponibles**: 300, 400, 500, 600, 700
- **Fallback**: system-ui, sans-serif

### Hiérarchie Typographique

#### Headings
```css
/* H1 - Hero */
text-4xl sm:text-5xl lg:text-6xl font-black leading-tight uppercase

/* H2 - Sections */
text-3xl sm:text-4xl md:text-5xl font-black text-black uppercase

/* H3 - Sous-sections */
text-xl font-black text-black uppercase

/* H4 - Cards */
text-lg font-black text-sm
```

#### Body Text
```css
/* Texte principal */
text-lg font-bold text-black/70

/* Texte secondaire */
text-sm font-bold text-black/50

/* Labels et petits textes */
text-xs font-black text-black uppercase
```

### Espacement Typographique
- **Line-height**: `leading-tight` (1.25), `leading-relaxed` (1.625)
- **Letter-spacing**: `tracking-wide` (0.05em), `tracking-wider` (0.1em)
- **Text transform**: `uppercase` pour les headers et labels

---

## 🎯 Style des Composants

### 1. Boutons

#### Bouton Primaire (Jaune)
```css
bg-yellow-400 text-black font-black text-sm uppercase px-8 py-4 rounded-full 
border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
hover:translate-x-[3px] hover:translate-y-[3px]
active:translate-y-1 active:shadow-none
transition-all
```

#### Bouton Secondaire (Noir)
```css
bg-black text-yellow-400 font-black text-sm uppercase px-8 py-4 rounded-full 
border-2 border-black shadow-[6px_6px_0px_0px_rgba(255,255,255,0.5)]
hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.5)]
hover:translate-x-[3px] hover:translate-y-[3px]
active:translate-y-1 active:shadow-none
transition-all
```

#### Bouton Tertiaire (Blanc)
```css
bg-white text-black font-black text-sm uppercase px-8 py-4 rounded-full 
border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
hover:translate-x-[2px] hover:translate-y-[2px]
active:translate-y-1 active:shadow-none
transition-all
```

### 2. Cards / Containers

#### Card Principale
```css
bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
```

#### Card Secondaire
```css
bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
```

#### Card avec fond jaune
```css
bg-yellow-50 border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
```

### 3. Inputs / Formulaires

#### Input Standard
```css
w-full px-4 py-3 text-sm font-bold bg-white border-2 border-black rounded-xl 
outline-none focus:ring-2 focus:ring-yellow-400 
placeholder:text-black/30
```

#### Input Centré (Chat)
```css
w-full px-4 py-3 text-sm font-bold bg-white border-2 border-black rounded-xl 
outline-none focus:ring-2 focus:ring-yellow-400 
placeholder:text-black/30 text-center
```

### 4. Navigation

#### Nav Links
```css
px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide text-black 
hover:bg-yellow-400 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
hover:border-black border-2 border-transparent
transition-all duration-200
```

#### Burger Menu (Mobile)
```css
w-11 h-11 rounded-xl bg-yellow-400 border-2 border-black 
shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
hover:translate-x-[2px] hover:translate-y-[2px]
active:translate-y-1 active:shadow-none
transition-all
```

---

## 📐 Espacement Global

### Padding/Margin Standards
```css
/* Sections */
py-14 sm:py-20          /* Padding vertical sections */
py-16 sm:py-24          /* Padding vertical grandes sections */
px-4 sm:px-6 lg:px-8    /* Padding horizontal responsive */

/* Containers */
max-w-7xl mx-auto       /* Container principal */
max-w-5xl mx-auto       /* Container formulaire */
max-w-4xl mx-auto       /* Container centré */

/* Espacements internes */
gap-3 gap-4 gap-6 gap-8 /* Grid gaps */
mb-4 mb-6 mb-8 mb-14    /* Margin bottom */
p-4 p-6 p-8             /* Padding cards */
```

### Espacements Typographiques
```css
mb-1                    /* Labels */
mb-2                    /* Petits éléments */
mb-4                    /* Cards */
mb-5 mb-6              /* Sections */
mb-8 mb-10 mb-14       /* Grandes sections */
```

---

## 🎭 Animations & Transitions

### Transitions Standard
```css
transition-all duration-200           /* Interactions rapides */
transition-all duration-300           /* Animations moyennes */
transition-all                       /* Animations complexes */
```

### Transforms au Hover
```css
/* Boutons */
hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
hover:translate-x-[3px] hover:translate-y-[3px]

/* Active state */
active:translate-y-1 active:shadow-none

/* Scale */
hover:scale-110
hover:scale-105

/* Rotation */
hover:rotate-0
rotate-2
```

### Animations CSS
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn { animation: fadeIn 0.3s ease-in-out; }
.animate-bounce { animation: bounce 1s infinite; }
```

---

## 🌟 Ombres (Box Shadows)

### Ombres Néo-brutalistes
```css
/* Ombre principale (8px) */
shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]

/* Ombre moyenne (6px) */
shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]

/* Ombre petite (4px) */
shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]

/* Ombre minimale (3px) */
shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]

/* Ombre hover (réduite) */
shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]

/* Ombre subtile */
shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]
```

---

## 🔄 Border Radius

### Rayons d'arrondissement
```css
rounded-full           /* Boutons, badges */
rounded-2xl           /* Cards principales */
rounded-xl            /* Cards secondaires */
rounded-lg            /* Images */
rounded-[3px]         /* Stars avis */
```

---

## 🎨 Ambiance Générale (Vibe)

### Style Principal: **Néo-brutaliste Ludique**

#### Caractéristiques:
- **Ludique et joyeux**: Jaune vif, émojis, animations amusantes
- **Néo-brutaliste**: Bordures épaisses noires, ombres pixelisées
- **Cartoon/Simpsons**: Références directes à l'univers cartoon
- **Premium malgré tout**: Typographie soignée (Poppins), espacements généreux
- **Accessible**: Contraste élevé, hiérarchie claire

#### Émotions véhiculées:
- **Fun et créatif**: Style cartoon, couleurs vives
- **Confiant**: Design audacieux, pas peur de se démarquer
- **Approchable**: Émojis, ton amical
- **Professionnel**: Structure clean, typo soignée

---

## 🎯 Patterns de Design Récurrents

### 1. Structure des Sections
```css
<section className="py-14 sm:py-20 border-b-4 border-black">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 className="text-center text-3xl sm:text-4xl font-black uppercase mb-14">
      Titre de section
    </h2>
    <!-- Contenu -->
  </div>
</section>
```

### 2. Cards avec Hover
```css
<div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
     hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
     hover:translate-x-[2px] hover:translate-y-[2px]
     transition-all">
```

### 3. Boutons d'action
```css
<button className="bg-yellow-400 text-black font-black uppercase px-8 py-4 
                rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                hover:translate-x-[2px] hover:translate-y-[2px]
                active:translate-y-1 active:shadow-none
                transition-all">
```

---

## 📱 Responsive Design

### Breakpoints utilisés
- **sm**: 640px+
- **md**: 768px+  
- **lg**: 1024px+

### Patterns responsive
```css
/* Grid responsive */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

/* Texte responsive */
text-4xl sm:text-5xl lg:text-6xl

/* Espacement responsive */
px-4 sm:px-6 lg:px-8
py-14 sm:py-20

/* Layout responsive */
flex-col md:flex-row
text-center md:text-left
```

---

## 🎨 Tokens CSS Personnalisés

### Variables CSS définies
```css
:root {
  --color-primary: #ffd23a;
  --color-primary-dark: #c39500;
  --color-secondary: #45a6ff;
  --color-accent: #9c3605;
  --color-accent-light: #ee5208;
  --color-bg: #ffffff;
  --color-bg-alt: #fef9e7;
  --color-text: #252525;
  --color-text-muted: #606c9c;
  --font-sans: var(--font-poppins), system-ui, sans-serif;
}
```

---

## 🚀 Recommandations d'Utilisation

### Pour recréer ce Design System:

1. **Installer les dépendances**:
   ```bash
   npm install @tailwindcss/postcss tailwindcss
   npm install @next/font/google poppins
   ```

2. **Configurer Tailwind CSS v4** avec les tokens personnalisés

3. **Utiliser Poppins** comme police principale

4. **Appliquer le pattern néo-brutaliste**: bordures épaisses + ombres pixelisées

5. **Maintenir la cohérence**: toujours utiliser les mêmes classes pour les mêmes éléments

### Points forts du système:
- ✅ **Cohérent**: Mêmes patterns répétés partout
- ✅ **Accessible**: Contraste élevé, hiérarchie claire
- ✅ **Responsive**: Mobile-first bien pensé
- ✅ **Animé**: Micro-interactions soignées
- ✅ **Unique**: Identité visuelle forte

### Points d'attention:
- 🔄 **Maintenance**: Garder la cohérence des ombres/transforms
- 📱 **Performance**: Optimiser les animations sur mobile
- 🎨 **Accessibilité**: Vérifier les contrastes régulièrement
- 📐 **Scale**: Documenter les nouveaux composants

---

## 📊 Résumé des Tokens

| Catégorie | Valeur | Utilisation |
|----------|--------|-------------|
| **Primary** | `#ffd23a` | Boutons, accents, headers |
| **Secondary** | `#45a6ff` | Liens, éléments secondaires |
| **Accent** | `#ee5208` | Erreurs, alertes |
| **Background** | `#ffffff` | Fond principal |
| **Text** | `#252525` | Texte principal |
| **Border** | `#000000` | Toutes les bordures |
| **Shadow** | `8px 8px 0px rgba(0,0,0,1)` | Cards principales |
| **Radius** | `1rem` (rounded-xl) | Cards standard |
| **Font** | `Poppins` | Typographie principale |

Ce Design System est **prêt à être réutilisé** et constitue une base solide pour tout projet e-commerce avec une identité visuelle forte et ludique.
