#!/bin/sh

set -e

npm version patch
npm run build
npm publish
