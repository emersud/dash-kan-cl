# Guia de Implementação do Esquema de Cores Upgrade (Dark / Light Mode)

Este guia fornece a especificação atualizada e harmonizada de tokens de design e variáveis CSS para a aplicação **DEVBoard / EduProject / MYwallet**, resolvendo os problemas de contraste entre tabelas/cards e o fundo da tela.

---

## 🎨 Análise de UX/UI & Harmonização

### Imagem 1 (Versão Original)
* **Problema:** A tabela principal utiliza um fundo branco sólido (`#FFFFFF`) com texto escuro em uma interface com tema totalmente escuro/deep slate (`#080E15`). Isso gera um efeito de **ofuscamento visual (glare)** e um contraste abrupto de brilho, quebrando a hierarquia e causando fadiga ocular.
* **Badges:** As badges de status em tons saturados puros de azul e verde sobre fundo branco criam ruído excessivo de luminosidade.

### Imagem 2 (Sugestão Harmonizada)
* **Solução:** A tabela foi integrada ao mesmo tom de superfície dos cards superiores (`#121F2D`), mantendo uma linguagem de **Dark Surface** consistente.
* **Tipografia & Badges:** O texto passou a ser claro (`#F0F4F8`), e as badges adotaram fundos semitransparentes com opacidade suave (`rgba`), garantindo a diferenciação categórica sem competir pela atenção do usuário.

---

## 🎨 Paleta de Cores Base (Harmonizada)

| Nome da Cor | Hexadecimal | RGB | Aplicação & Uso |
| :--- | :---: | :---: | :--- |
| **Primary / Accent Blue** | `#1686B9` | `22, 134, 185` | Botões primários, itens selecionados da sidebar, badges da turma |
| **Primary Hover / Vivid Cyan** | `#1EA1DC` | `30, 161, 220` | Estados de hover em botões primários e links ativados |
| **Secondary / Emerald Green** | `#14C16E` | `20, 193, 110` | Badges de status "Concluído", indicadores de sucesso |
| **Amber / Warning** | `#F59E0B` | `245, 158, 11` | Status de pendência ou alerta ("Primeiro Acesso") |
| **Slate Gray / Card Surface** | `#121F2D` | `18, 31, 45` | Fundo harmonizado de tabelas, cards de turmas e containers |
| **Slate Hover / Row Zebra** | `#18283A` | `24, 40, 58` | Linhas alternadas de tabelas e hover de cards |

---

## 🌙 e ☀️ Variáveis CSS (CSS Custom Properties)

Copie e cole o bloco abaixo no seu arquivo global de estilos (`globals.css` ou `styles.css`):

```css
/* ==========================================================================
   THEME DESIGN TOKENS (UPGRADE VERSION)
   ========================================================================== */

:root {
  /* Default Theme: Dark Mode (Harmonized Dark Slate) */
  
  /* Palette Colors */
  --color-primary: #1686b9;
  --color-primary-hover: #1ea1dc;
  --color-secondary: #14c16e;
  --color-secondary-hover: #109e5a;
  --color-warning: #f59e0b;
  --color-slate: #465567;
  --color-sky: #76bbf8;

  /* Surfaces & Backgrounds (Harmonizados sem contraste abrupto) */
  --bg-app: #080e15;            /* Fundo principal profundo */
  --bg-sidebar: #0d1620;        /* Sidebar com distinção suave */
  --bg-card: #121f2d;           /* Fundo unificado para cards E tabelas */
  --bg-card-hover: #18283a;     /* Hover de cards e linhas de tabela */
  --bg-table-header: #0f1924;    /* Cabeçalho da tabela levemente destacado */
  --bg-input: #0b131c;          /* Inputs e filtros de busca */
  --bg-badge: rgba(22, 134, 185, 0.15); /* Fundo translúcido para badges */

  /* Borders & Dividers */
  --border-color: #1e3044;      /* Bordas sutis integradas */
  --border-subtle: #162434;     /* Divisores de linhas de tabela */
  --border-focus: #1ea1dc;      /* Highlight de foco */

  /* Typography (Acessibilidade mantida em superfícies escuras) */
  --text-primary: #f0f4f8;      /* Títulos e textos de alta relevância */
  --text-secondary: #94a3b8;    /* Subtítulos, headers de tabelas e labels */
  --text-muted: #64748b;        /* Textos auxiliares e ícones inativos */
  --text-on-primary: #ffffff;   /* Texto em botões primários */

  /* Status Badges Tokens */
  --badge-done-bg: rgba(20, 193, 110, 0.15);
  --badge-done-text: #34d399;
  --badge-pending-bg: rgba(245, 158, 11, 0.15);
  --badge-pending-text: #fbbf24;
  --badge-info-bg: rgba(22, 134, 185, 0.2);
  --badge-info-text: #38bdf8;
}

/* Light Mode Overrides */
[data-theme="light"], .light {
  /* Palette Adjustments for Light Contrast */
  --color-primary: #12729e;
  --color-primary-hover: #0e587a;
  --color-secondary: #0f9b58;
  --color-secondary-hover: #0c7b46;
  --color-warning: #d97706;
  --color-slate: #5a6b7c;
  --color-sky: #2563eb;

  /* Surfaces & Backgrounds */
  --bg-app: #f4f7fa;            
  --bg-sidebar: #ffffff;        
  --bg-card: #ffffff;           
  --bg-card-hover: #f8fafc;     
  --bg-table-header: #f1f5f9;
  --bg-input: #edf2f7;          
  --bg-badge: #e2e8f0;          

  /* Borders & Dividers */
  --border-color: #e2e8f0;
  --border-subtle: #f1f5f9;
  --border-focus: #12729e;

  /* Typography */
  --text-primary: #0f172a;      
  --text-secondary: #475569;    
  --text-muted: #94a3b8;
  --text-on-primary: #ffffff;

  /* Status Badges Tokens */
  --badge-done-bg: #d1fae5;
  --badge-done-text: #065f46;
  --badge-pending-bg: #fef3c7;
  --badge-pending-text: #92400e;
  --badge-info-bg: #e0f2fe;
  --badge-info-text: #075985;
}
```

---

## 🚀 Configuração Atualizada do Tailwind CSS

Adicione as novas chaves ao seu `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1686B9',
          'blue-hover': '#1EA1DC',
          green: '#14C16E',
          slate: '#465567',
          sky: '#76BBF8',
        },
        app: {
          bg: 'var(--bg-app)',
          sidebar: 'var(--bg-sidebar)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          'table-header': 'var(--bg-table-header)',
          input: 'var(--bg-input)',
          badge: 'var(--bg-badge)',
          border: 'var(--border-color)',
          'border-subtle': 'var(--border-subtle)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        }
      },
    },
  },
  plugins: [],
}
```

---

## 💻 Exemplo Prático de Componente Tabela Harmonizada (HTML / JSX)

```html
<div class="table-container">
  <div class="table-header-bar">
    <h2>Alunos Cadastrados (7)</h2>
    <input type="text" placeholder="Buscar aluno..." class="search-input" />
  </div>

  <table class="custom-table">
    <thead>
      <tr>
        <th>Aluno</th>
        <th>E-mail</th>
        <th>Turma</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="user-cell">
          <span class="avatar-icon">👤</span> João Silva
        </td>
        <td class="text-secondary">joao@aluno.com</td>
        <td><span class="badge badge-info">1C - Informática</span></td>
        <td><span class="badge badge-pending">Primeiro acesso</span></td>
      </tr>
      <tr>
        <td class="user-cell">
          <span class="avatar-icon">👤</span> Maria Santos
        </td>
        <td class="text-secondary">maria@aluno.com</td>
        <td><span class="badge badge-info">1C - Informática</span></td>
        <td><span class="badge badge-done">Concluído</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

### Estilização CSS da Tabela Harmonizada:

```css
.table-container {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.table-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text-primary);
}

.custom-table th {
  background-color: var(--bg-table-header);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85rem;
  text-align: left;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
}

.custom-table td {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.9rem;
}

.custom-table tbody tr {
  transition: background-color 0.15s ease;
}

.custom-table tbody tr:hover {
  background-color: var(--bg-card-hover);
}

/* Badges de Status Ajustadas */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-info {
  background-color: var(--badge-info-bg);
  color: var(--badge-info-text);
}

.badge-done {
  background-color: var(--badge-done-bg);
  color: var(--badge-done-text);
}

.badge-pending {
  background-color: var(--badge-pending-bg);
  color: var(--badge-pending-text);
}
```