const downloadURI = (uri: string, name: string): Promise<void> => {
  return new Promise((resolve) => {
    const link = document.createElement('a');
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    resolve();
  });
};

export { downloadURI };
