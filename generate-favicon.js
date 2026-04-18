const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'public', 'assets', 'images', 'logo.png');
const outputPath = path.join(__dirname, 'public', 'favicon.ico');

async function generateFavicon() {
  try {
    await sharp(logoPath)
      .resize(32, 32)
      .png()
      .toFile(outputPath.replace('.ico', '.png'));
    
    // Renommer le PNG en ICO (fonctionne car ICO peut contenir du PNG)
    fs.renameSync(outputPath.replace('.ico', '.png'), outputPath);
    console.log('Favicon généré avec succès :', outputPath);
  } catch (error) {
    console.error('Erreur lors de la génération du favicon :', error);
  }
}

generateFavicon();