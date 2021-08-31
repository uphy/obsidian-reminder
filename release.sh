#!/bin/bash

VERSION=$1
MINIMUM_OBSIDIAN_VERSION=0.12.12

if [ -z "$1" ]; then
    echo Specify a version
    exit 1
fi

echo $VERSION | egrep '^\d+\.\d+\.\d+$' > /dev/null
if [ $? -ne 0 ]; then
    echo "Invalid version format: $VERSION"
    exit 1
fi

git branch --show-current | grep '^master$' > /dev/null
if [ $? -ne 0 ]; then
    echo "Not in master branch."
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo "build error"
    exit 1
fi

sed -i '' -e 's/"version": .*/"version": "'$VERSION'",/' package.json
sed -i '' -e 's/"version": .*/"version": "'$VERSION'",/' manifest.json

VERSIONS_FILE_TEMP=$(mktemp)
jq '. + {"'$VERSION'": "'$MINIMUM_OBSIDIAN_VERSION'"}' versions.json > $VERSIONS_FILE_TEMP
mv $VERSIONS_FILE_TEMP versions.json

git add .
git commit -m "Release v$VERSION"
git tag $VERSION
git push
git push --tags

gh release create "$VERSION" --notes "$VERSION" main.js styles.css manifest.json
