import('./app-module.js').catch(error => {
  console.error(error)
  const status = document.querySelector('#dpe-status')
  if (status) {
    status.textContent = 'Le module DPE ne peut pas être chargé actuellement. Réessayer plus tard ou utiliser l’Observatoire ADEME.'
  }
})
