#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NEWTIME=`date +"%Y-%m-%d %H:%M:%S"`
OLDTIME=`tail -n1 $DIR/.runlog`
if [[ $2 == "all" ]]; then
  OLDTIME=`head -n1 $DIR/.runlog`
fi

/usr/bin/node $DIR/index.js -p $1 -d "$OLDTIME" && echo $NEWTIME >> $DIR/.runlog && echo "Complete"
