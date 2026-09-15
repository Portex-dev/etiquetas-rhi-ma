# Registro de Etiquetas

Este contexto reúne a linguagem usada para registrar digitalmente etiquetas associadas aos equipamentos da RHI MA e para consultar esses registros sob acesso controlado.

## Language

**Etiqueta**:
Classificação visual e funcional de uma anomalia registrada em um equipamento: vermelha para manutenção, amarela para projeto de melhoria ou azul para limpeza e organização.
_Avoid_: Chamado, ocorrência

**Registro de Etiqueta**:
Relato digital de uma etiqueta, contendo a identificação livre do colaborador, o equipamento, a classificação, as descrições, a data automática e, opcionalmente, uma foto.
_Avoid_: Protocolo

**Novo**:
Estado inicial de um Registro de Etiqueta que ainda não foi reconhecido por uma Pessoa Autorizada.
_Avoid_: Pendente, aberto

**Visto**:
Estado reversível de um Registro de Etiqueta que já foi reconhecido por uma Pessoa Autorizada, sem indicar tratamento ou conclusão da anomalia.
_Avoid_: Resolvido, concluído, fechado

**Lixeira**:
Conjunto de Registros de Etiquetas excluídos da consulta normal, mas ainda recuperáveis por uma Pessoa Autorizada durante o período de retenção.
_Avoid_: Exclusão definitiva, arquivo

**Colaborador**:
Pessoa que envia um Registro de Etiqueta sem precisar consultar o histórico de registros.
_Avoid_: Usuário comum, solicitante

**Pessoa Autorizada**:
Pessoa que utiliza a credencial administrativa compartilhada para consultar Registros de Etiquetas e alterná-los entre Novo e Visto.
_Avoid_: Usuário especial

**Área**:
Agrupamento operacional ao qual um ou mais Equipamentos pertencem, como M-10 ou RK-1.
_Avoid_: Setor, local

**Equipamento**:
Ativo identificado pelo seu nome exato dentro de uma Área e ao qual um Registro de Etiqueta é associado; a letra “x” em F-901-x-1 e F-901-x-2 faz parte do nome.
_Avoid_: Máquina

**Acesso por Equipamento**:
Entrada no formulário de registro com Área e Equipamento previamente determinados pelo link ou QR Code correspondente.
_Avoid_: QR do registro

**Acesso Geral**:
Entrada no fluxo de registro em que o Colaborador escolhe livremente a Área e o Equipamento, inclusive quando está distante do QR Code correspondente.
_Avoid_: Acesso administrativo
