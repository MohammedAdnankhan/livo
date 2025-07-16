exports.pagination = async (req, res, next) => {
  req.paginate = {
    limit: req.query.limit ? parseInt(req.query.limit) : 5,
    offset: req.query.page
      ? parseInt((req.query.page - 1) * (req.query.limit || 10))
      : 0,
  };

  delete req.query.limit;
  delete req.query.page;

  next();
};
