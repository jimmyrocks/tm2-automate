#!/bin/bash
NEWTIME=`date +"%Y-%m-%d %H:%M:%S"`
OLDTIME=`tail -n1 .runlog`
if [[ $2 == "all" ]]; then
  OLDTIME=`head -n1 .runlog`
fi

node ./index.js -p $1 -d "$OLDTIME" && echo $NEWTIME >> .runlog && echo "Complete!"

