const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dr3pitbr2',
  api_key: '293466963246363',
  api_secret: 'mCyH2c-qSs3U40OwKKCAxhitj8M'
});

cloudinary.api.resources({ type: 'upload', max_results: 50 })
  .then(result => {
    result.resources.forEach(r => {
      console.log(r.secure_url);
    });
  });