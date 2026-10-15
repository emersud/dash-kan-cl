# Peer Evaluation — Plano de Integração ao Sistema Existente

## 1. Objetivo

Adicionar ao sistema atual um módulo de **Peer Evaluation (avaliação por pares)**, integrado à estrutura já existente de alunos, grupos e registros diários, sem substituir nem quebrar as funcionalidades atuais.

O sistema já possui:
- cadastro de alunos;
- alocação de alunos em grupos;
- registro diário (*Daily Register*);
- registro de tarefas do aluno;
- check-in diário do aluno;
- registro de lições aprendidas.

O novo módulo deve permitir que cada aluno avalie a contribuição dos demais integrantes de seu grupo usando cinco critérios comportamentais. Em seguida, o sistema deve calcular as médias recebidas por critério e apresentá-las em um **gráfico radar** individual, com filtros por período e uma visão administrativa para professor ou responsável.

Este documento descreve a arquitetura funcional, as regras de negócio, o fluxo, os dados, as telas, os cálculos, a privacidade e os critérios de aceite. A implementação deverá adaptar-se à tecnologia, aos padrões, à estrutura e às convenções já existentes no repositório.

## 2. Princípios de integração

1. **Reutilizar o que existe:** usar os cadastros de alunos, grupos, relações de pertencimento e autenticação já disponíveis.
2. **Não duplicar cadastros:** não criar uma segunda tabela ou módulo independente de alunos ou grupos.
3. **Adicionar de forma incremental:** introduzir o novo módulo com o menor impacto possível nas funcionalidades existentes.
4. **Manter responsabilidades separadas:** as avaliações por pares são registros distintos de tarefas, check-ins e lições aprendidas. Esses registros podem servir como contexto para reflexão, mas não devem alterar automaticamente as notas da avaliação.
5. **Respeitar a autorização atual:** usar o mecanismo de autenticação, papéis e permissões já existente.
6. **Priorizar feedback formativo:** os resultados devem apoiar reflexão e melhoria, não funcionar como ranking de popularidade.
7. **Projetar para períodos:** cada avaliação deve estar vinculada a um período definido, como uma Sprint, ciclo ou intervalo de avaliação.
8. **Não presumir tecnologia:** antes de implementar, a IA deve inspecionar o projeto e seguir suas convenções de arquitetura, nomenclatura, validação, persistência, testes e interface.

## 3. Escopo funcional

### 3.1 Incluído

- Avaliação de colegas do mesmo grupo.
- Autoavaliação desabilitada por padrão: o objetivo principal é medir a percepção dos pares. A avaliação do próprio aluno não entra no cálculo da média dos pares.
- Cinco critérios avaliados em escala de 1 a 5.
- Comentário construtivo opcional.
- Registro de período/Sprint.
- Prevenção de autoavaliação e de duplicidade de avaliações para a mesma combinação de avaliador, avaliado e período.
- Acompanhamento de quem já avaliou e quem ainda precisa avaliar.
- Cálculo de média por critério para cada aluno avaliado.
- Gráfico radar com os cinco critérios e escala de 1 a 5.
- Filtros por período e, conforme as permissões existentes, por grupo e aluno.
- Painel para professor/administrador acompanhar adesão e resultados.
- Proteção de comentários e identificação dos avaliadores conforme a política de privacidade definida.
- Testes de regras de negócio, cálculos, permissões e integração.

### 3.2 Fora do escopo inicial

Não implementar na primeira versão, salvo se o sistema já tiver esses recursos e a integração for simples:
- avaliação 360 graus completa com múltiplas categorias de avaliadores;
- pesos combinando autoavaliação, pares e professor;
- classificação pública, ranking ou medalhas;
- cálculo automático de nota acadêmica;
- inferência automática de desempenho a partir de tarefas, check-ins ou lições aprendidas;
- análise automatizada de sentimentos dos comentários;
- avaliação entre grupos diferentes.

A primeira versão deve concentrar-se na **avaliação por pares**. A arquitetura pode permitir expansão futura sem exigir essa complexidade agora.

## 4. Critérios de avaliação

Cada avaliador atribui uma nota inteira de 1 a 5 para cada critério.

### 4.1 Colaboração
**Descrição:** Ajuda colegas, compartilha conhecimentos e contribui para o resultado coletivo.

Pergunta apresentada ao aluno:
> O colega ajuda os demais, compartilha conhecimentos e contribui para o resultado coletivo?

### 4.2 Responsabilidade
**Descrição:** Cumpre os acordos e sinaliza impedimentos com antecedência.

Pergunta:
> O colega cumpre os acordos e comunica impedimentos com antecedência?

### 4.3 Comunicação
**Descrição:** Compartilha informações, escuta e participa das decisões.

Pergunta:
> O colega compartilha informações, escuta os outros e participa das decisões?

### 4.4 Qualidade das entregas
**Descrição:** Segue os requisitos, testa as soluções e cuida da qualidade técnica.

Pergunta:
> O colega segue os requisitos, testa as soluções e cuida da qualidade técnica de suas entregas?

### 4.5 Autonomia e iniciativa
**Descrição:** Identifica problemas e propõe soluções sem depender constantemente de orientação.

Pergunta:
> O colega identifica problemas e propõe soluções sem depender constantemente de orientação?

### 4.6 Escala

| Nota | Rótulo | Orientação |
|---:|---|---|
| 1 | Precisa melhorar muito | O comportamento foi raramente observado ou ficou muito aquém do esperado. |
| 2 | Abaixo do esperado | O comportamento aparece de forma inconsistente e precisa de melhoria. |
| 3 | Adequado | O comportamento atende ao esperado na maior parte das situações observadas. |
| 4 | Muito bom | O comportamento é consistente e contribui positivamente para a equipe. |
| 5 | Excelente | O comportamento é consistente, proativo e contribui de forma muito significativa. |

Apresentar a mesma escala e os mesmos critérios para todos os alunos. Orientar que a avaliação deve se basear em interações e evidências observadas durante o período, não em amizade, conflito isolado ou popularidade.

Não incluir uma opção numérica “0”. Se o aluno não tiver observado o colega o suficiente para fazer uma avaliação justa, oferecer uma opção explícita **“Não tenho evidências suficientes para avaliar”**. Essa opção não deve ser armazenada como nota nem entrar na média. Se essa opção não for permitida na primeira versão, tornar os cinco critérios obrigatórios e apresentar orientação para que o aluno só avalie colegas com quem trabalhou o suficiente.

## 5. Modelo conceitual de dados

A IA deve examinar o esquema atual antes de criar qualquer estrutura. Os nomes abaixo são ilustrativos; adaptar ao padrão já utilizado. Reutilizar os identificadores e relacionamentos reais de aluno, grupo, usuário e período.

### 5.1 Entidade/tabela de períodos de avaliação

Reutilizar a entidade existente de Sprint, ciclo ou período, se houver. Se não existir um conceito equivalente, criar uma entidade mínima de período de avaliação.

Campos conceituais possíveis:
- identificador;
- nome ou rótulo (por exemplo, “Sprint 2”);
- data inicial;
- data final;
- estado: rascunho, aberto, encerrado;
- referência ao projeto/turma/grupo conforme a estrutura existente;
- datas de criação e atualização, se esse padrão já for utilizado.

Regras:
- somente períodos abertos aceitam novas avaliações ou alterações;
- períodos encerrados ficam somente para consulta, salvo fluxo administrativo explícito para reabertura;
- a aplicação deve validar o estado no servidor, não apenas ocultar botões na interface.

### 5.2 Entidade/tabela de avaliações por pares

Criar uma entidade própria para representar a avaliação de um aluno por outro aluno em um período.

Campos conceituais:
- identificador único;
- referência ao aluno avaliador;
- referência ao aluno avaliado;
- referência ao grupo válido para o período;
- referência ao período/Sprint;
- nota de colaboração;
- nota de responsabilidade;
- nota de comunicação;
- nota de qualidade das entregas;
- nota de autonomia e iniciativa;
- comentário construtivo opcional;
- estado do envio, caso haja rascunho;
- data de criação;
- data de atualização/envio, conforme o padrão existente.

As notas devem ser inteiros de 1 a 5 ou nulas apenas quando a regra “não tenho evidências suficientes” for suportada. Não usar zero como substituto de ausência de avaliação.

Não é necessário armazenar a média da avaliação como dado primário; ela pode ser calculada a partir das cinco notas. Se o projeto tiver uma razão de desempenho ou escala que justifique materializar resultados, documentar a razão e garantir consistência após alterações.

### 5.3 Integridade e restrições

Implementar, na camada de persistência sempre que possível e também na camada de domínio/serviço:

- o avaliador não pode ser o mesmo aluno que o avaliado;
- ambos devem ser alunos válidos e estar associados ao grupo correspondente durante o período;
- avaliador e avaliado devem pertencer ao mesmo grupo elegível no período;
- o período precisa estar aberto para criar ou editar uma avaliação;
- cada avaliador pode enviar no máximo uma avaliação para cada avaliado em cada período;
- as notas válidas são inteiros entre 1 e 5;
- um envio não pode existir sem os campos obrigatórios;
- excluir ou desativar alunos/grupos não deve corromper o histórico de avaliações; seguir a estratégia de exclusão lógica ou integridade referencial já adotada pelo sistema;
- aplicar chaves estrangeiras, índices e restrições únicas compatíveis com a tecnologia atual.

Restrição lógica de unicidade:
`(period_id, evaluator_student_id, evaluated_student_id)`

Se a composição dos grupos puder mudar durante o período, definir a regra com base no histórico de alocação ou em uma fotografia da composição do grupo no início do período. Não inferir retrospectivamente o grupo atual para validar avaliações antigas. Se o sistema não guardar histórico de grupos, registrar a associação válida no próprio registro de avaliação ou propor uma solução consistente com o modelo atual.

### 5.4 Comentários

- O comentário é opcional.
- Orientar comentários específicos, respeitosos e baseados em comportamentos observáveis.
- Não permitir conteúdo ofensivo, ameaças ou exposição desnecessária de dados pessoais; aplicar as regras gerais de moderação já existentes, se houver.
- Não exibir comentários brutos a toda a equipe por padrão.
- A política de anonimato deve ser definida antes da publicação do módulo. Recomendação inicial: os colegas veem resultados agregados e comentários anonimizados ou moderados; professor/responsável autorizado pode ter acesso identificado quando isso for necessário e informado aos participantes.
- Não prometer anonimato absoluto se o sistema, os metadados ou o tamanho do grupo puderem revelar a identidade do avaliador. Em grupos pequenos, explicar a limitação aos usuários.

## 6. Regras de negócio

1. O aluno autenticado só pode avaliar alunos elegíveis do seu próprio grupo para o período selecionado.
2. Não permitir autoavaliação no módulo Peer Evaluation.
3. Uma avaliação por par avaliado, por avaliador e por período.
4. A avaliação pode ser salva como rascunho se isso estiver implementado; rascunhos não entram nas médias.
5. Apenas avaliações enviadas/confirmadas entram nos cálculos.
6. Uma avaliação enviada pode ser editável até o encerramento do período, se essa política for habilitada. Após o encerramento, não pode ser alterada por alunos.
7. Avaliações incompletas não entram nos cálculos até serem enviadas.
8. Uma avaliação não deve ser contabilizada duas vezes por recarregamento, reenvio ou repetição de requisição.
9. O sistema deve informar quantos colegas o aluno precisa avaliar e quantas avaliações foram concluídas, sem revelar como cada colega avaliou os outros.
10. A pessoa avaliada não deve poder editar ou excluir avaliações recebidas.
11. O professor/responsável só pode acessar os grupos e turmas permitidos por suas permissões atuais.
12. O aluno só pode consultar os resultados autorizados para si. A visibilidade dos resultados dos colegas deve ser configurável e conservadora por padrão.
13. A troca de grupo não deve transferir automaticamente avaliações antigas para um novo grupo nem permitir que alunos avaliem colegas que não eram elegíveis no período.
14. Os dados de tarefas, check-in diário e lições aprendidas não devem preencher ou alterar notas automaticamente.
15. Se não houver avaliações válidas para determinado critério, apresentar “Sem dados” ou “Aguardando avaliações”, nunca média zero.
16. As médias devem ser calculadas com precisão suficiente e arredondadas apenas para exibição, por exemplo, duas casas decimais.
17. O sistema deve distinguir “não recebeu avaliações”, “avaliações pendentes” e “avaliação concluída”. Não confundir ausência de dados com baixo desempenho.

## 7. Fluxo do aluno

### 7.1 Entrada no módulo
Adicionar um item de navegação chamado **“Avaliação por Pares”** ou equivalente, seguindo o padrão visual e de navegação existente.

### 7.2 Seleção do período
- Mostrar o período/Sprint aberto por padrão.
- Se houver mais de um período acessível, permitir seleção.
- Exibir datas e estado do período.
- Se não houver período aberto, informar que não há avaliação disponível no momento.

### 7.3 Lista de colegas
- Carregar os integrantes elegíveis a partir dos grupos já cadastrados.
- Excluir o aluno autenticado da lista de pessoas a avaliar.
- Mostrar o estado por colega: “Pendente”, “Rascunho” ou “Concluída”.
- Não mostrar notas recebidas por outros alunos nem a identidade dos avaliadores.
- Permitir abrir o formulário de um colega pendente ou editar um rascunho, quando permitido.

### 7.4 Formulário
Para o colega selecionado:
- exibir nome/foto conforme o padrão de privacidade atual;
- exibir período avaliado;
- exibir os cinco critérios, suas descrições e a escala 1–5;
- permitir comentário opcional;
- apresentar orientação breve: “Avalie comportamentos observados durante o período. Seja respeitoso, específico e construtivo”;
- oferecer ações de salvar rascunho, se houver suporte, e enviar avaliação;
- pedir confirmação antes do envio final;
- após o envio, mostrar confirmação e atualizar o estado da lista.

### 7.5 Conclusão
Apresentar progresso, por exemplo, “3 de 4 colegas avaliados”. O progresso é calculado sobre os colegas elegíveis, excluindo o próprio aluno. Se algum colega não tiver trabalhado suficientemente com o avaliador, aplicar a regra definida para “não tenho evidências suficientes”, sem criar uma nota artificial.

## 8. Painel de resultados e gráfico radar

### 8.1 Radar individual
Criar uma visualização com cinco eixos:
1. Colaboração;
2. Responsabilidade;
3. Comunicação;
4. Qualidade das entregas;
5. Autonomia e iniciativa.

Requisitos:
- escala mínima 1 e máxima 5;
- exibir o nome de cada critério;
- mostrar média recebida por critério;
- mostrar os valores numéricos junto ao gráfico ou em uma legenda acessível;
- usar a média das avaliações válidas recebidas de colegas;
- não incluir autoavaliação;
- não incluir rascunhos, avaliações não enviadas ou avaliações inválidas;
- exibir a quantidade de avaliações válidas recebidas no período;
- apresentar “Sem dados” quando não houver respostas válidas;
- oferecer filtro por Sprint/período;
- adaptar-se a telas menores e manter uma alternativa textual/acessível aos dados do gráfico.

### 8.2 Fórmula da média por critério

Para cada aluno avaliado, período e critério:

`média_do_critério = soma das notas válidas recebidas no critério / quantidade de notas válidas recebidas no critério`

Exemplo fictício: um aluno recebe notas 5, 4 e 4 em Colaboração. A média é `(5 + 4 + 4) / 3 = 4,33`.

Calcular cada critério de forma independente. Se um critério tiver menos respostas válidas do que outro, informar a quantidade de respostas considerada para cada um, especialmente se “não tenho evidências suficientes” for permitido.

Arredondar apenas para exibição. Não usar notas de tarefas, check-ins, lições aprendidas, autoavaliação ou avaliação do professor na média de pares.

### 8.3 Visão do aluno
Por padrão, o aluno deve visualizar:
- seu próprio radar;
- as médias dos cinco critérios;
- a quantidade de respostas válidas;
- o período avaliado;
- recomendações ou prompts de reflexão, sem julgamento automático;
- histórico de evolução entre períodos, quando houver dados comparáveis.

Não revelar automaticamente as notas individuais atribuídas por cada colega nem comentários identificáveis.

### 8.4 Visão do professor/administrador
Conforme as permissões existentes, oferecer:
- filtro por turma, grupo, período e aluno;
- estado de participação: avaliações esperadas, enviadas e pendentes;
- radar individual;
- visão agregada do grupo;
- médias por critério e número de respostas válidas;
- acesso a comentários conforme política de privacidade;
- alertas de baixa participação ou dados insuficientes, sem rotular automaticamente o aluno como de baixo desempenho.

Não exibir ranking público por nota. Se for necessário comparar resultados para apoiar o acompanhamento pedagógico, priorizar tendências, critérios e planos de melhoria, com acesso restrito.

### 8.5 Evolução entre períodos
Permitir comparar radares de diferentes Sprints, desde que:
- os critérios e a escala sejam os mesmos;
- o período esteja claramente identificado;
- a quantidade de avaliações recebidas seja mostrada;
- a interface não sugira uma tendência conclusiva quando houver poucas respostas ou composição de grupo muito diferente.

## 9. Integração com Daily Register

O novo módulo deve ser independente do fluxo diário atual. O Daily Register continua responsável por:
- tarefas do aluno;
- check-in diário;
- lições aprendidas.

Integrações opcionais futuras:
- permitir acesso à avaliação por pares a partir da página do grupo ou do projeto;
- sugerir que o aluno reflita sobre evidências registradas durante a Sprint;
- permitir ao professor consultar avaliações e registros diários no contexto do projeto, se tiver permissão.

Não:
- transformar tarefas concluídas em notas de responsabilidade automaticamente;
- deduzir colaboração apenas por quantidade de comentários ou check-ins;
- utilizar o número de tarefas como substituto de qualidade;
- publicar dados do Daily Register para colegas avaliadores sem uma finalidade clara e autorização;
- alterar ou reestruturar o fluxo diário existente para acomodar o novo recurso.

## 10. Arquitetura funcional sugerida

Adaptar os componentes às convenções já existentes, mas preservar separação lógica entre:

1. **Interface**
   - navegação do módulo;
   - lista de colegas e estado de preenchimento;
   - formulário;
   - painel individual;
   - painel administrativo;
   - gráfico radar.

2. **Camada de aplicação/domínio**
   - localizar alunos elegíveis;
   - validar período e composição do grupo;
   - criar/editar/enviar avaliação;
   - impedir autoavaliação e duplicidade;
   - calcular médias por critério;
   - aplicar regras de autorização.

3. **Persistência**
   - usar entidades/tabelas existentes de alunos, grupos e períodos;
   - adicionar armazenamento próprio para as avaliações;
   - criar restrições e índices adequados;
   - garantir integridade histórica.

4. **Autorização e privacidade**
   - reutilizar autenticação atual;
   - validar autorização no servidor/camada de domínio;
   - proteger consultas e mutações;
   - controlar acesso a comentários e identidade dos avaliadores.

5. **Relatórios/visualização**
   - disponibilizar dados agregados para o radar;
   - manter cálculo da média em uma única camada confiável;
   - não duplicar fórmulas diferentes na interface e no servidor.

Se a arquitetura atual separar frontend, API e banco de dados, manter esse padrão. Se usar uma arquitetura monolítica, seguir a organização existente sem introduzir serviços desnecessários.

## 11. Contratos funcionais de API ou operações

A implementação deve adaptar os nomes e protocolos ao padrão atual. Conceitualmente, são necessárias operações equivalentes a:

- listar períodos de avaliação acessíveis;
- listar colegas elegíveis e estado de avaliação do usuário autenticado;
- criar ou salvar rascunho de avaliação;
- enviar avaliação;
- consultar o radar/médias de um aluno e período;
- consultar painel administrativo com filtros e autorização;
- consultar contagens de participação.

Regras de segurança:
- não confiar em `evaluator_student_id` enviado pelo cliente; derivar a identidade do usuário autenticado no servidor;
- validar o grupo e o período no servidor;
- validar cada nota no servidor;
- não aceitar que um aluno solicite resultados administrativos apenas alterando parâmetros;
- filtrar os dados pelo escopo de acesso do usuário;
- responder com erros compreensíveis para período encerrado, colega inelegível, duplicidade e dados inválidos;
- evitar revelar a identidade de avaliadores em mensagens de erro ou respostas não autorizadas.

## 12. Privacidade, ética e segurança

A avaliação por pares pode conter dados pessoais e comentários sensíveis. A implementação deve:
- explicar aos alunos a finalidade da avaliação e quem poderá consultar cada tipo de dado;
- coletar somente os dados necessários;
- restringir acesso por papel e escopo;
- definir se os avaliadores serão anônimos para os alunos avaliados e comunicar essa política;
- ocultar identidade do avaliador em telas de aluno quando a política exigir anonimato;
- lembrar que comentários, horário e grupos muito pequenos podem permitir inferência de identidade;
- manter logs técnicos sem expor o conteúdo dos comentários além do necessário;
- aplicar as políticas de retenção e exclusão de dados já existentes;
- evitar ranking público, exposição vexatória ou uso da média como único indicador de competência;
- fornecer canal de acompanhamento pelo professor para relatos ofensivos ou avaliações claramente abusivas.

O anonimato não deve ser tratado como garantido sem analisar o sistema, os metadados e o tamanho do grupo. Se a aplicação não puder garantir anonimato real, apresentar a avaliação como confidencial, explicando quem pode ver a identidade.

## 13. Estados e mensagens de interface

Estados mínimos:
- período sem avaliação aberta;
- avaliações pendentes;
- rascunho salvo;
- avaliação enviada;
- todos os colegas avaliados;
- período encerrado;
- nenhum resultado disponível;
- número insuficiente de avaliações;
- falha de rede ou erro ao salvar;
- acesso não autorizado.

As mensagens devem ser claras e não culpabilizantes. Exemplo:
- “Você avaliou 2 de 4 colegas.”
- “Esta avaliação foi enviada.”
- “Ainda não há avaliações suficientes para exibir a média.”
- “O período foi encerrado e não aceita alterações.”
- “Não foi possível salvar. Tente novamente.”

## 14. Plano de implementação incremental

### Fase 1 — Inspeção e planejamento
- examinar a estrutura atual do repositório;
- localizar entidades de aluno, grupo, alocação, projeto, Sprint/período e usuário;
- identificar autenticação, papéis, autorização e padrão de navegação;
- identificar padrões de persistência, validação, migração, testes e visualizações;
- registrar um plano curto de alteração antes de editar;
- não substituir bibliotecas, frameworks ou arquitetura sem necessidade justificada.

### Fase 2 — Modelo e regras
- definir o vínculo com os alunos e grupos existentes;
- definir ou reutilizar o conceito de período;
- criar a entidade de avaliação;
- implementar integridade, unicidade e validações;
- criar migração compatível com o banco atual;
- preservar todos os dados existentes.

### Fase 3 — Operações de domínio
- listar colegas elegíveis;
- salvar e enviar avaliações;
- controlar estados do período;
- impedir autoavaliação e duplicidade;
- calcular médias por critério;
- aplicar autorização em todas as operações.

### Fase 4 — Interface de avaliação
- adicionar item de navegação;
- criar lista de colegas e status;
- criar formulário com cinco critérios;
- incluir comentário opcional;
- implementar confirmação de envio e mensagens de erro;
- adaptar o visual aos componentes e padrões atuais.

### Fase 5 — Dashboard e radar
- criar consulta agregada das médias;
- implementar gráfico radar;
- mostrar escala, valores e quantidade de respostas;
- incluir filtros por período;
- criar visão administrativa conforme as permissões;
- garantir acessibilidade e comportamento responsivo.

### Fase 6 — Testes e validação
- executar testes automatizados existentes;
- adicionar testes de domínio, integração, autorização e interface;
- testar migração em ambiente de desenvolvimento;
- validar que Daily Register e demais recursos continuam funcionando;
- revisar o fluxo com dados fictícios antes de disponibilizar para alunos.

### Fase 7 — Entrega
- documentar as alterações;
- listar arquivos e estruturas criados/modificados;
- documentar comandos de migração e execução conforme o projeto;
- informar testes executados e seus resultados;
- indicar configurações ou decisões que ainda dependem do responsável;
- não afirmar que algo foi testado se não foi efetivamente executado.

## 15. Casos de teste obrigatórios

### Elegibilidade e integridade
- aluno pode avaliar colega do mesmo grupo e período aberto;
- aluno não pode avaliar a si mesmo;
- aluno não pode avaliar integrante de outro grupo;
- aluno não pode enviar avaliação para período encerrado;
- avaliador não pode duplicar avaliação para o mesmo colega e período;
- notas fora de 1–5 são rejeitadas;
- rascunho não entra na média;
- avaliação incompleta não pode ser enviada se os critérios forem obrigatórios;
- mudança de grupo não corrompe avaliações históricas.

### Cálculos
- média de cada critério é calculada apenas com envios válidos;
- critérios sem notas exibem “Sem dados”, não zero;
- comentários não afetam a média;
- tarefas, check-ins e lições aprendidas não afetam a média;
- autoavaliação, caso venha a existir futuramente, não entra na média de pares;
- arredondamento é aplicado apenas para exibição;
- quantidade de respostas exibida corresponde às avaliações válidas usadas no cálculo.

### Permissões e privacidade
- aluno não acessa painel administrativo;
- aluno não altera avaliações de outra pessoa;
- aluno não vê identidade de avaliadores quando a política a ocultar;
- professor só acessa grupos autorizados;
- endpoints/ações não permitem contornar permissões alterando identificadores;
- comentários ficam disponíveis somente aos papéis autorizados.

### Interface e regressão
- formulário funciona em desktop e dispositivos móveis;
- lista de colegas atualiza o status após envio;
- gráfico apresenta os cinco eixos e escala 1–5;
- estados vazios e de erro são compreensíveis;
- navegação existente continua funcionando;
- tarefas, check-in diário e lições aprendidas continuam funcionando sem regressão.

## 16. Critérios de aceite

A funcionalidade estará pronta quando:

1. Acessar os alunos e grupos existentes sem duplicar cadastros.
2. O período de avaliação for definido ou reutilizado a partir de uma entidade existente.
3. Um aluno puder avaliar os colegas elegíveis do próprio grupo.
4. As cinco dimensões e a escala 1–5 estiverem implementadas.
5. A aplicação impedir autoavaliação, duplicidade e avaliação fora do período/grupo permitido.
6. As avaliações enviadas forem persistidas e protegidas por autorização.
7. O sistema calcular a média recebida em cada critério, por aluno e período.
8. O gráfico radar mostrar corretamente os cinco critérios e não inventar valores quando não houver dados.
9. A interface indicar o número de avaliações válidas que fundamentam o resultado.
10. O professor/responsável autorizado puder acompanhar participação e consultar os resultados permitidos.
11. A política de confidencialidade estiver explícita e aplicada na interface e nas operações.
12. O Daily Register existente permanecer intacto e funcional.
13. Os testes essenciais passarem, com resultados documentados.
14. A implementação seguir os padrões do projeto, sem reescrita tecnológica desnecessária.

## 17. Orientação final para a IA que executará este plano

Antes de escrever código, inspecione o repositório e identifique a arquitetura real. Não presuma nomes de tabelas, campos, componentes, rotas ou bibliotecas. Reutilize os cadastros e relacionamentos existentes, adapte este plano às convenções do projeto e faça alterações pequenas e verificáveis.

Priorize integridade dos dados, autorização no servidor, privacidade, experiência simples para o aluno e compatibilidade com o Daily Register. Implemente primeiro o fluxo mínimo completo — período, avaliação, validação, persistência, cálculo e radar — e só depois considere extensões.

Não reescreva funcionalidades existentes nem substitua tecnologias sem necessidade. Execute os testes relevantes e entregue um resumo fiel do que foi alterado, do que foi testado e de qualquer limitação remanescente.
