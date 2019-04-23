from flask import Flask, request, session, g, redirect, url_for, abort, \
     render_template, flash, redirect

app = Flask(__name__) # create the application instance :)

@app.route('/', methods=['POST'])
def on_webhook(payload):
    print(payload)
    print('hiiiiii')

if __name__ == '__main__':
    app.run(debug=True)