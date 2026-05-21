#!/bin/bash

# Cores para logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sem Cor

echo -e "${BLUE}=== Fluvius Auto-Release Utility ===${NC}"

# Detectar a versão atual a partir do arquivo version.ts
VERSION_FILE="frontend/src/version.ts"
if [ -f "$VERSION_FILE" ]; then
    # Extrai o valor de dentro de export const APP_VERSION = 'x.y.z';
    DETECTED_VERSION=$(grep -oE "[0-9]+\.[0-9]+\.[0-9]+" "$VERSION_FILE")
fi

# Se o usuário passou uma versão por parâmetro, usa ela. Senão usa a detectada.
VERSION=${1:-$DETECTED_VERSION}

if [ -z "$VERSION" ]; then
    echo -e "${RED}Erro: Não foi possível detectar a versão e nenhum parâmetro foi informado.${NC}"
    echo "Uso: ./release.sh [versao]"
    exit 1
fi

echo -e "${BLUE}Preparando release para a versão:${NC} ${GREEN}v$VERSION${NC}"

# Verificar se estamos em um repositório git
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Erro: Este diretório não é um repositório Git.${NC}"
    exit 1
fi

# Detectar branch atual
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Branch atual detectada:${NC} ${YELLOW}$CURRENT_BRANCH${NC}"

# Adicionar todas as modificações
echo -e "${BLUE}Adicionando arquivos modificados ao Git...${NC}"
git add .

# Verificar se existem alterações pendentes para commitar
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Aviso: Nenhuma alteração pendente de código encontrada para commitar.${NC}"
else
    # Executar o Commit
    COMMIT_MSG="chore(release): $VERSION [skip ci]"
    echo -e "${BLUE}Executando commit:${NC} '${YELLOW}$COMMIT_MSG${NC}'"
    git commit -m "$COMMIT_MSG"
fi

# Verificar se a tag já existe localmente ou remotamente
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo -e "${YELLOW}Aviso: A tag v$VERSION já existe localmente. Sobrescrevendo a tag...${NC}"
    git tag -d "v$VERSION"
fi

# Criar a tag
TAG_MSG="Release v$VERSION - Fluvius Helpdesk"
echo -e "${BLUE}Criando tag:${NC} ${GREEN}v$VERSION${NC}"
git tag -a "v$VERSION" -m "$TAG_MSG"

# Fazer o push da branch atual e das tags
echo -e "${BLUE}Enviando alterações e tags para o repositório remoto (origin)...${NC}"
echo -e "${YELLOW}Comando: git push origin $CURRENT_BRANCH --follow-tags${NC}"
git push origin "$CURRENT_BRANCH" --follow-tags

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✔ Lançamento da versão v$VERSION concluído com sucesso!${NC}"
else
    echo -e "\n${RED}✘ Falha ao enviar alterações para o origin. Verifique suas conexões e chaves SSH/Git.${NC}"
    exit 1
fi
