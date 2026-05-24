/**
 * Módulo de template para geração de relatórios em PDF do Zero Um Stock Manager.
 * Exporta o HTML e CSS diagramado em 3 páginas A4 limpas no estilo premium dourado/escuro.
 */

export const gerarRelatorioHtml = ({
  nomeArquivo,
  dataHoraGeracao,
  dataInicioFmt,
  dataFimFmt,
  operadorNome,
  operadorCargo,
  faturamentoHoje,
  qtdHoje,
  totalEstoqueItens,
  valorEstoqueVenda,
  totalModelosCadastrados,
  estoqueCriticoLimitado,
  totalEstoqueCriticoCount,
  topSellers,
  formasPagamentoList,
  relatorioStats,
  rankingVendedoresPeriodo,
  totalDevolvido,
  totalNovo,
  saldoTrocasConsolidado,
  totalDescontos,
  faturamentoBruto
}) => {
  // --- CONSTRUÇÃO DO HTML DAS TABELAS ---

  // 1. Tabela de Formas de Pagamento
  const filtradasFP = formasPagamentoList.filter(item => item.value > 0);
  let formasPagamentoHtml = "";
  if (filtradasFP.length === 0) {
    formasPagamentoHtml = `
      <tr>
        <td colspan="4" class="text-center text-muted" style="padding: 20px;">Nenhum faturamento registrado no período selecionado.</td>
      </tr>
    `;
  } else {
    formasPagamentoHtml = filtradasFP.map(item => {
      const pct = relatorioStats.totalFaturado > 0 ? (item.value / relatorioStats.totalFaturado) * 100 : 0;
      return `
        <tr class="zebra">
          <td class="font-bold">${item.label}</td>
          <td class="text-right font-bold text-emerald">R$ ${item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td class="text-right font-bold">${pct.toFixed(0)}%</td>
          <td>
            <div class="bar-container"><div class="bar-fill" style="width: ${pct}%"></div></div>
          </td>
        </tr>
      `;
    }).join("") + `
      <tr class="total-row">
        <td class="font-bold">TOTAL FATURADO</td>
        <td class="text-right font-bold text-emerald">R$ ${relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-bold">100%</td>
        <td></td>
      </tr>
    `;
  }

  // 2. Tabela de Vendedores
  let rankingVendedoresHtml = "";
  if (rankingVendedoresPeriodo.length === 0) {
    rankingVendedoresHtml = `
      <tr>
        <td colspan="5" class="text-center text-muted" style="padding: 15px;">Nenhuma venda registrada por colaboradores no período.</td>
      </tr>
    `;
  } else {
    rankingVendedoresHtml = rankingVendedoresPeriodo.map((v, index) => {
      const isFirst = index === 0 && v.total > 0;
      const cargo = v.role === "admin" ? "Administrador" : "Colaborador";
      return `
        <tr class="${isFirst ? 'highlight font-bold' : 'zebra'}">
          <td class="text-center font-bold">${isFirst ? '🥇 1º' : `${index + 1}º`}</td>
          <td>${v.nome}</td>
          <td>${cargo}</td>
          <td class="text-right text-emerald font-bold">R$ ${v.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td class="text-center font-bold">${v.quantidade} un</td>
        </tr>
      `;
    }).join("");
  }

  // 3. Tabela de Alertas de Reposição (Estoque Crítico)
  let estoqueCriticoHtml = "";
  if (estoqueCriticoLimitado.length === 0) {
    estoqueCriticoHtml = `
      <div class="empty-box">
        ✅ Estoque saudável! Todos os produtos estão com níveis acima do estoque mínimo.
      </div>
    `;
  } else {
    estoqueCriticoHtml = `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Produto</th>
            <th>Marca</th>
            <th class="text-center" style="width: 80px;">Estoque Atual</th>
            <th class="text-center" style="width: 80px;">Mín. Configurado</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${estoqueCriticoLimitado.map(b => `
            <tr class="zebra">
              <td class="font-bold font-mono">${b.codigo}</td>
              <td class="font-bold">${b.nome}</td>
              <td>${b.marca || "—"}</td>
              <td class="text-center font-bold text-rose">${b.quantidade} un</td>
              <td class="text-center text-muted">${b.quantidade_minima || 2} un</td>
              <td class="text-center">
                <span class="tag tag-cobranca">${b.quantidade === 0 ? "ESGOTADO" : "BAIXO ESTOQUE"}</span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${totalEstoqueCriticoCount > 10 ? `
        <p style="font-size: 7.5pt; color: #DC2626; font-weight: 600; text-align: right; margin-top: -5px;">
          * Exibindo as 10 peças mais críticas. Existem mais ${totalEstoqueCriticoCount - 10} peças abaixo do estoque mínimo.
        </p>
      ` : ""}
    `;
  }

  // 4. Tabela de Top Sellers
  let topSellersHtml = "";
  if (topSellers.length === 0) {
    topSellersHtml = `
      <div class="empty-box">
        Nenhuma venda registrada no período filtrado.
      </div>
    `;
  } else {
    topSellersHtml = `
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 50px;">Pos.</th>
            <th>Código</th>
            <th>Modelo de Bolsa</th>
            <th class="text-center" style="width: 100px;">Qtd. Vendida</th>
            <th class="text-right" style="width: 150px;">Faturamento Bruto</th>
          </tr>
        </thead>
        <tbody>
          ${topSellers.map((item, idx) => `
            <tr class="zebra">
              <td class="text-center font-bold">${idx + 1}º</td>
              <td class="font-mono text-muted">${item.codigo}</td>
              <td class="font-bold">${item.nome}</td>
              <td class="text-center font-bold">${item.quantidade} un</td>
              <td class="text-right font-bold text-emerald">R$ ${item.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  // --- RETORNO DO HTML CONSOLIDADO ---
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${nomeArquivo}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap');
        
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }
        
        @media screen {
          #print-area-container {
            display: none !important;
          }
        }
        
        @media print {
          #root {
            display: none !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #FFFFFF !important;
          }
          #print-area-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }

        #print-area-container {
          font-family: 'Inter', sans-serif;
          color: #1A1A2E;
          background-color: #FFFFFF;
          font-size: 8.5pt;
          line-height: 1.4;
        }
        
        #print-area-container h1, 
        #print-area-container h2, 
        #print-area-container h3, 
        #print-area-container h4, 
        #print-area-container .title-font {
          font-family: 'Outfit', sans-serif;
        }
        
        #print-area-container .page {
          position: relative;
          box-sizing: border-box;
          width: 210mm;
          height: 297mm;
          padding: 18mm 20mm 20mm 20mm;
          page-break-after: always !important;
          break-after: page !important;
          overflow: hidden;
          background-color: #FFFFFF;
        }
        
        #print-area-container .print-header {
          border-bottom: 2px solid #C9A84C;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #print-area-container .print-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        #print-area-container .logo-box {
          width: 40px;
          height: 40px;
          background-color: #1A1A2E;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #C9A84C;
          font-weight: 800;
          font-size: 16pt;
          border: 1.5px solid #C9A84C;
        }
        #print-area-container .store-title {
          font-size: 14pt;
          font-weight: 800;
          color: #1A1A2E;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        #print-area-container .store-subtitle {
          font-size: 8pt;
          color: #6B7280;
          margin: 0;
          font-weight: 500;
        }
        #print-area-container .print-header-right {
          text-align: right;
        }
        #print-area-container .doc-title {
          font-size: 12pt;
          font-weight: 800;
          color: #C9A84C;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        #print-area-container .doc-date {
          font-size: 8pt;
          color: #6B7280;
          margin: 2px 0 0 0;
          font-weight: 500;
        }
        
        #print-area-container .print-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
          color: #6B7280;
          margin-top: -8px;
          margin-bottom: 20px;
          font-weight: 500;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 8px;
        }
        
        #print-area-container .print-footer {
          position: absolute;
          bottom: 12mm;
          left: 20mm;
          right: 20mm;
          border-top: 1px solid #E5E7EB;
          padding-top: 8px;
          text-align: center;
          font-size: 7.5pt;
          color: #9CA3AF;
          font-weight: 500;
        }
        
        #print-area-container .section {
          margin-bottom: 22px;
        }
        #print-area-container .section-title {
          font-size: 11pt;
          font-weight: 800;
          color: #1A1A2E;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        #print-area-container .section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background-color: #E5E7EB;
          margin-left: 8px;
        }
        #print-area-container .section-subtitle {
          font-size: 8pt;
          color: #6B7280;
          margin: 0 0 10px 0;
          font-weight: 500;
        }
        
        #print-area-container table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        #print-area-container th {
          background-color: #F9FAFB;
          border-bottom: 2px solid #C9A84C;
          padding: 6px 8px;
          font-size: 7.5pt;
          font-weight: 800;
          text-transform: uppercase;
          color: #1A1A2E;
          text-align: left;
          letter-spacing: 0.05em;
        }
        #print-area-container td {
          padding: 6px 8px;
          border-bottom: 1px solid #E5E7EB;
          font-size: 8.5pt;
          color: #1A1A2E;
        }
        #print-area-container tr.zebra:nth-child(even) {
          background-color: #FCFAF7;
        }
        #print-area-container tr.highlight {
          background-color: #FFFDF5 !important;
          font-weight: 600;
        }
        #print-area-container tr.total-row td {
          border-top: 2px solid #C9A84C;
          border-bottom: 2px solid #C9A84C;
          font-weight: 800;
          background-color: #FDFBF7 !important;
        }
        
        #print-area-container .text-right { text-align: right; }
        #print-area-container .text-center { text-align: center; }
        #print-area-container .font-bold { font-weight: 700; }
        #print-area-container .text-gold { color: #C9A84C; }
        #print-area-container .text-emerald { color: #059669; }
        #print-area-container .text-rose { color: #DC2626; }
        #print-area-container .text-muted { color: #9CA3AF; }
        
        #print-area-container .kpis-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        #print-area-container .kpi-card {
          background-color: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-top: 3px solid #C9A84C;
          border-radius: 6px;
          padding: 10px 12px;
          box-sizing: border-box;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        #print-area-container .kpi-label {
          font-size: 7.5pt;
          font-weight: 800;
          text-transform: uppercase;
          color: #6B7280;
          letter-spacing: 0.05em;
          display: block;
        }
        #print-area-container .kpi-value {
          font-size: 14pt;
          font-weight: 800;
          color: #1A1A2E;
          margin-top: 4px;
          display: block;
        }
        #print-area-container .kpi-desc {
          font-size: 7pt;
          color: #9CA3AF;
          margin-top: 3px;
          display: block;
          font-weight: 500;
        }
        
        #print-area-container .bar-container {
          width: 80px;
          background-color: #E5E7EB;
          height: 6px;
          border-radius: 3px;
          display: inline-block;
          vertical-align: middle;
          overflow: hidden;
          margin-right: 6px;
        }
        #print-area-container .bar-fill {
          height: 100%;
          background-color: #C9A84C;
          border-radius: 3px;
        }
        
        #print-area-container .tag {
          display: inline-block;
          font-size: 7pt;
          font-weight: 800;
          text-transform: uppercase;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.03em;
          border: 1px solid transparent;
        }
        #print-area-container .tag-promo {
          color: #C9A84C;
          background-color: #FDFBF7;
          border-color: rgba(201, 168, 76, 0.2);
        }
        #print-area-container .tag-credito {
          color: #059669;
          background-color: #ECFDF5;
          border-color: rgba(5, 150, 105, 0.2);
        }
        #print-area-container .tag-cobranca {
          color: #DC2626;
          background-color: #FEF2F2;
          border-color: rgba(220, 38, 38, 0.2);
        }
        
        #print-area-container .empty-box {
          background-color: #F9FAFB;
          border: 1px dashed #E5E7EB;
          border-radius: 6px;
          padding: 15px;
          text-align: center;
          color: #6B7280;
          font-size: 8.5pt;
          font-weight: 500;
        }
        
        #print-area-container .signature-block {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
          gap: 40px;
        }
        #print-area-container .signature-line {
          flex: 1;
          border-top: 1px solid #1A1A2E;
          text-align: center;
          padding-top: 6px;
          font-size: 8pt;
          font-weight: 600;
          margin-top: 20px;
          color: #1A1A2E;
        }
      </style>
    </head>
    <body>
      <div id="print-area-container">
        
        <!-- ================= PÁGINA 1: FATURAMENTO & PAGAMENTOS ================= -->
        <div class="page">
          <div class="print-header">
            <div class="print-header-left">
              <div class="logo-box">01</div>
              <div>
                <h1 class="store-title">Zero Um Stock Manager</h1>
                <p class="store-subtitle">Painel de Controle Executivo</p>
              </div>
            </div>
            <div class="print-header-right">
              <h2 class="doc-title">Resumo Financeiro</h2>
              <p class="doc-date">Emissão: ${dataHoraGeracao}</p>
            </div>
          </div>
          
          <div class="print-meta-row">
            <span>Período Selecionado: <strong>${dataInicioFmt}</strong> a <strong>${dataFimFmt}</strong></span>
            <span>Operador: <strong>${operadorNome}</strong> (${operadorCargo})</span>
          </div>
          
          <div class="section">
            <h3 class="section-title">Indicadores de Faturamento</h3>
            <p class="section-subtitle">Métricas principais de vendas e receita do período filtrado</p>
            
            <div class="kpis-grid">
              <div class="kpi-card">
                <span class="kpi-label">💰 Faturamento Total</span>
                <span class="kpi-value text-emerald">R$ ${relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Faturamento no período</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">📅 Vendas de Hoje</span>
                <span class="kpi-value">R$ ${faturamentoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Total de hoje (${qtdHoje} un)</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">📦 Peças Vendidas</span>
                <span class="kpi-value">${relatorioStats.totalSair} un</span>
                <span class="kpi-desc">Saídas registradas</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">🎯 Ticket Médio</span>
                <span class="kpi-value text-gold">R$ ${(relatorioStats.totalSair > 0 ? relatorioStats.totalFaturado / relatorioStats.totalSair : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Média por peça vendida</span>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3 class="section-title">Distribuição por Forma de Pagamento</h3>
            <p class="section-subtitle">Detalhamento dos valores recebidos por método de pagamento</p>
            
            <table>
              <thead>
                <tr>
                  <th>Método de Pagamento</th>
                  <th class="text-right">Valor Faturado</th>
                  <th class="text-right">% Participação</th>
                  <th>Representação Visual</th>
                </tr>
              </thead>
              <tbody>
                ${formasPagamentoHtml}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h3 class="section-title">Análise de Descontos Concedidos</h3>
            <p class="section-subtitle">Resumo de abatimentos e descontos aplicados no período</p>
            
            <table style="max-width: 500px; margin: 0 auto;">
              <tbody>
                <tr>
                  <td>Faturamento sem descontos (Faturamento Bruto):</td>
                  <td class="text-right font-bold">R$ ${faturamentoBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Total de descontos aplicados nas vendas:</td>
                  <td class="text-right text-rose font-bold">
                    ${totalDescontos > 0 ? `- R$ ${totalDescontos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `<span class="text-muted">—</span>`}
                  </td>
                </tr>
                <tr class="total-row">
                  <td class="font-bold">FATURAMENTO LÍQUIDO DO PERÍODO:</td>
                  <td class="text-right font-bold text-emerald">R$ ${relatorioStats.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="print-footer">
            Zero Um Stock Manager &nbsp;|&nbsp; Página 1 de 3 &nbsp;|&nbsp; Confidencial &nbsp;|&nbsp; Gerado pelo Sistema
          </div>
        </div>
        
        <!-- ================= PÁGINA 2: EQUIPE & CONTROLE DE ESTOQUE ================= -->
        <div class="page">
          <div class="print-header">
            <div class="print-header-left">
              <div class="logo-box">01</div>
              <div>
                <h1 class="store-title">Zero Um Stock Manager</h1>
                <p class="store-subtitle">Painel de Controle Executivo</p>
              </div>
            </div>
            <div class="print-header-right">
              <h2 class="doc-title">Estoque & Vendas</h2>
              <p class="doc-date">Emissão: ${dataHoraGeracao}</p>
            </div>
          </div>
          
          <div class="print-meta-row">
            <span>Período Selecionado: <strong>${dataInicioFmt}</strong> a <strong>${dataFimFmt}</strong></span>
            <span>Operador: <strong>${operadorNome}</strong></span>
          </div>
          
          <div class="section">
            <h3 class="section-title">Desempenho de Vendas por Colaborador</h3>
            <p class="section-subtitle">Ranking de faturamento e quantidade vendida por colaborador no período</p>
            
            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 60px;">Posição</th>
                  <th>Colaborador</th>
                  <th>Cargo</th>
                  <th class="text-right">Faturamento Total</th>
                  <th class="text-center" style="width: 120px;">Quantidade Vendida</th>
                </tr>
              </thead>
              <tbody>
                ${rankingVendedoresHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h3 class="section-title">Visão Geral do Estoque Físico</h3>
            <p class="section-subtitle">Volume físico e potencial de faturamento do estoque atual da loja hoje</p>
            
            <div class="kpis-grid" style="grid-template-columns: repeat(3, 1fr);">
              <div class="kpi-card" style="border-top-color: #1A1A2E;">
                <span class="kpi-label">👜 Total de Peças</span>
                <span class="kpi-value">${totalEstoqueItens} un</span>
                <span class="kpi-desc">Unidades em estoque</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">💰 Valor de Venda</span>
                <span class="kpi-value text-emerald">R$ ${valorEstoqueVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Potencial de faturamento</span>
              </div>
              <div class="kpi-card" style="border-top-color: #6B7280;">
                <span class="kpi-label">📂 Modelos Ativos</span>
                <span class="kpi-value">${totalModelosCadastrados}</span>
                <span class="kpi-desc">Modelos cadastrados</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">Alertas de Reposição (Estoque Crítico)</h3>
            <p class="section-subtitle">Produtos com quantidade em estoque igual ou abaixo do estoque mínimo configurado</p>
            
            ${estoqueCriticoHtml}
          </div>
          
          <div class="print-footer">
            Zero Um Stock Manager &nbsp;|&nbsp; Página 2 de 3 &nbsp;|&nbsp; Confidencial &nbsp;|&nbsp; Gerado pelo Sistema
          </div>
        </div>
        
        <!-- ================= PÁGINA 3: FLUXO DE MOVIMENTAÇÕES & TROCAS ================= -->
        <div class="page">
          <div class="print-header">
            <div class="print-header-left">
              <div class="logo-box">01</div>
              <div>
                <h1 class="store-title">Zero Um Stock Manager</h1>
                <p class="store-subtitle">Painel de Controle Executivo</p>
              </div>
            </div>
            <div class="print-header-right">
              <h2 class="doc-title">Movimentações & Trocas</h2>
              <p class="doc-date">Emissão: ${dataHoraGeracao}</p>
            </div>
          </div>
          
          <div class="print-meta-row">
            <span>Período Selecionado: <strong>${dataInicioFmt}</strong> a <strong>${dataFimFmt}</strong></span>
            <span>Operador: <strong>${operadorNome}</strong></span>
          </div>

          <div class="section">
            <h3 class="section-title">Fluxo Físico de Mercadorias (Período)</h3>
            <p class="section-subtitle">Movimentação física de mercadorias no período selecionado</p>
            
            <div class="kpis-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 10px;">
              <div class="kpi-card" style="border-top-color: #059669;">
                <span class="kpi-label">📥 Entradas Físicas</span>
                <span class="kpi-value text-emerald">+ ${totalEntradasPeriodo} un</span>
                <span class="kpi-desc">Peças adicionadas</span>
              </div>
              <div class="kpi-card" style="border-top-color: #DC2626;">
                <span class="kpi-label">📤 Saídas Físicas</span>
                <span class="kpi-value text-rose">- ${relatorioStats.totalSair} un</span>
                <span class="kpi-desc">Peças vendidas</span>
              </div>
              <div class="kpi-card" style="border-top-color: #2563EB;">
                <span class="kpi-label">⚖️ Saldo do Período</span>
                <span class="kpi-value ${(totalEntradasPeriodo - relatorioStats.totalSair) >= 0 ? "text-emerald" : "text-rose"}">
                  ${(totalEntradasPeriodo - relatorioStats.totalSair) >= 0 ? "+" : ""}${totalEntradasPeriodo - relatorioStats.totalSair} un
                </span>
                <span class="kpi-desc">Variação do estoque</span>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3 class="section-title">Resumo Financeiro de Trocas</h3>
            <p class="section-subtitle">Consolidado das operações de trocas efetuadas no período selecionado</p>
            
            <div class="kpis-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 15px;">
              <div class="kpi-card" style="border-top-color: #EA580C;">
                <span class="kpi-label">🔄 Quantidade de Trocas</span>
                <span class="kpi-value" style="color: #EA580C;">${relatorioTrocas.length} trocas</span>
                <span class="kpi-desc">Procedimentos efetuados</span>
              </div>
              <div class="kpi-card" style="border-top-color: #DC2626;">
                <span class="kpi-label">📉 Peças Devolvidas</span>
                <span class="kpi-value text-rose">R$ ${totalDevolvido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Valor recebido de volta</span>
              </div>
              <div class="kpi-card" style="border-top-color: #059669;">
                <span class="kpi-label">📈 Novas Peças Levadas</span>
                <span class="kpi-value text-emerald">R$ ${totalNovo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                <span class="kpi-desc">Valor das novas bolsas</span>
              </div>
            </div>
            
            <div class="kpi-card" style="border-left: 4px solid ${saldoTrocasConsolidado >= 0 ? '#059669' : '#DC2626'}; border-top: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 12px; background-color: ${saldoTrocasConsolidado >= 0 ? '#ECFDF5' : '#FEF2F2'};">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="kpi-label" style="color: ${saldoTrocasConsolidado >= 0 ? '#059669' : '#DC2626'}; font-weight: 800;">⚖️ Ajuste Financeiro de Trocas</span>
                  <span style="font-size: 7.5pt; color: #6B7280; display: block; margin-top: 1px; font-weight: 500;">
                    ${saldoTrocasConsolidado >= 0 
                      ? 'Diferença de valor cobrada e recebida dos clientes nas trocas.' 
                      : 'Crédito de loja gerado para utilização futura dos clientes.'}
                  </span>
                </div>
                <span class="kpi-value" style="color: ${saldoTrocasConsolidado >= 0 ? '#059669' : '#DC2626'}; font-size: 14pt; font-weight: 800; margin: 0;">
                  ${saldoTrocasConsolidado >= 0 ? '+' : ''} R$ ${saldoTrocasConsolidado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h3 class="section-title">Produtos mais Vendidos (Top Sellers)</h3>
            <p class="section-subtitle">Os 5 modelos de bolsas com maior volume de vendas no período</p>
            
            ${topSellersHtml}
          </div>

          <div class="section" style="margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 15px;">
            <p style="font-size: 8pt; color: #6B7280; margin: 0; text-align: center; font-weight: 500;">
              Relatório consolidado gerado via Zero Um Stock Manager. Declaro a exatidão das informações.
            </p>
            
            <div class="signature-block">
              <div class="signature-line">
                Assinatura do Responsável
              </div>
              <div class="signature-line">
                Assinatura do Conferente
              </div>
            </div>
            
            <p class="text-center" style="font-size: 7.5pt; color: #9CA3AF; margin-top: 25px; font-style: italic; text-align: center; font-weight: 500;">
              Zero Um Stock Manager © 2026 — Documento confidencial de uso exclusivo interno.
            </p>
          </div>
          
          <div class="print-footer">
            Zero Um Stock Manager &nbsp;|&nbsp; Página 3 de 3 &nbsp;|&nbsp; Confidencial &nbsp;|&nbsp; Gerado pelo Sistema
          </div>
        </div>
        
      </div>
    </body>
    </html>
  `;
};
